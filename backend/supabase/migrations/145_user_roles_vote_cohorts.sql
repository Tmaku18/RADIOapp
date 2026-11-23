-- Multiple maker roles, popular vs peer scores, and admin-only activity flags.
-- Flags never set is_banned. Ignored votes stay in the table and stay out of both scores.
-- Older votes with no cohort stay in the combined total until they are recast.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_roles text[] NOT NULL DEFAULT '{}';

UPDATE public.users
SET user_roles = ARRAY[role]::text[]
WHERE role IN ('artist', 'service_provider', 'musician', 'dj')
  AND cardinality(user_roles) = 0;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_user_roles_allowed;

ALTER TABLE public.users
  ADD CONSTRAINT users_user_roles_allowed
  CHECK (
    user_roles <@ ARRAY['artist', 'service_provider', 'musician', 'dj']::text[]
  );

ALTER TABLE public.leaderboard_likes
  ADD COLUMN IF NOT EXISTS voter_cohort text,
  ADD COLUMN IF NOT EXISTS counts_toward_score boolean NOT NULL DEFAULT true;

ALTER TABLE public.leaderboard_likes
  DROP CONSTRAINT IF EXISTS leaderboard_likes_voter_cohort_check;

ALTER TABLE public.leaderboard_likes
  ADD CONSTRAINT leaderboard_likes_voter_cohort_check
  CHECK (voter_cohort IS NULL OR voter_cohort IN ('popular', 'peer'));

ALTER TABLE public.song_listener_ratings
  ADD COLUMN IF NOT EXISTS voter_cohort text,
  ADD COLUMN IF NOT EXISTS counts_toward_score boolean NOT NULL DEFAULT true;

ALTER TABLE public.song_listener_ratings
  DROP CONSTRAINT IF EXISTS song_listener_ratings_voter_cohort_check;

ALTER TABLE public.song_listener_ratings
  ADD CONSTRAINT song_listener_ratings_voter_cohort_check
  CHECK (voter_cohort IS NULL OR voter_cohort IN ('popular', 'peer'));

ALTER TABLE public.song_temperature
  ADD COLUMN IF NOT EXISTS popular_fire_votes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS popular_shit_votes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS popular_temperature_percent integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS peer_fire_votes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peer_shit_votes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peer_temperature_percent integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS popular_rating_avg numeric,
  ADD COLUMN IF NOT EXISTS popular_rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peer_rating_avg numeric,
  ADD COLUMN IF NOT EXISTS peer_rating_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.activity_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_flags_created_at_idx
  ON public.activity_flags (created_at DESC);

ALTER TABLE public.activity_flags ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.refresh_song_temperature(p_song_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  fire_count integer := 0;
  shit_count integer := 0;
  total_count integer := 0;
  temp_percent integer := 50;
  pop_fire integer := 0;
  pop_shit integer := 0;
  peer_fire integer := 0;
  peer_shit integer := 0;
  pop_temp integer := 50;
  peer_temp integer := 50;
  pop_rating numeric := NULL;
  pop_rating_count integer := 0;
  peer_rating numeric := NULL;
  peer_rating_count integer := 0;
BEGIN
  IF p_song_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN reaction = 'fire' AND counts_toward_score THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN reaction = 'shit' AND counts_toward_score THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN reaction = 'fire' AND counts_toward_score AND voter_cohort = 'popular' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN reaction = 'shit' AND counts_toward_score AND voter_cohort = 'popular' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN reaction = 'fire' AND counts_toward_score AND voter_cohort = 'peer' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN reaction = 'shit' AND counts_toward_score AND voter_cohort = 'peer' THEN 1 ELSE 0 END), 0)
  INTO fire_count, shit_count, pop_fire, pop_shit, peer_fire, peer_shit
  FROM public.leaderboard_likes
  WHERE song_id = p_song_id;

  total_count := fire_count + shit_count;
  temp_percent := GREATEST(0, LEAST(100, 50 + fire_count - shit_count));
  pop_temp := GREATEST(0, LEAST(100, 50 + pop_fire - pop_shit));
  peer_temp := GREATEST(0, LEAST(100, 50 + peer_fire - peer_shit));

  SELECT
    AVG(rating) FILTER (WHERE counts_toward_score AND voter_cohort = 'popular'),
    COUNT(*) FILTER (WHERE counts_toward_score AND voter_cohort = 'popular'),
    AVG(rating) FILTER (WHERE counts_toward_score AND voter_cohort = 'peer'),
    COUNT(*) FILTER (WHERE counts_toward_score AND voter_cohort = 'peer')
  INTO pop_rating, pop_rating_count, peer_rating, peer_rating_count
  FROM public.song_listener_ratings
  WHERE song_id = p_song_id;

  INSERT INTO public.song_temperature (
    song_id,
    fire_votes,
    shit_votes,
    total_votes,
    decayed_fire_votes,
    decayed_shit_votes,
    temperature_percent,
    popular_fire_votes,
    popular_shit_votes,
    popular_temperature_percent,
    peer_fire_votes,
    peer_shit_votes,
    peer_temperature_percent,
    popular_rating_avg,
    popular_rating_count,
    peer_rating_avg,
    peer_rating_count,
    updated_at
  )
  VALUES (
    p_song_id,
    fire_count,
    shit_count,
    total_count,
    fire_count,
    shit_count,
    temp_percent,
    pop_fire,
    pop_shit,
    pop_temp,
    peer_fire,
    peer_shit,
    peer_temp,
    pop_rating,
    pop_rating_count,
    peer_rating,
    peer_rating_count,
    now()
  )
  ON CONFLICT (song_id)
  DO UPDATE SET
    fire_votes = EXCLUDED.fire_votes,
    shit_votes = EXCLUDED.shit_votes,
    total_votes = EXCLUDED.total_votes,
    decayed_fire_votes = EXCLUDED.decayed_fire_votes,
    decayed_shit_votes = EXCLUDED.decayed_shit_votes,
    temperature_percent = EXCLUDED.temperature_percent,
    popular_fire_votes = EXCLUDED.popular_fire_votes,
    popular_shit_votes = EXCLUDED.popular_shit_votes,
    popular_temperature_percent = EXCLUDED.popular_temperature_percent,
    peer_fire_votes = EXCLUDED.peer_fire_votes,
    peer_shit_votes = EXCLUDED.peer_shit_votes,
    peer_temperature_percent = EXCLUDED.peer_temperature_percent,
    popular_rating_avg = EXCLUDED.popular_rating_avg,
    popular_rating_count = EXCLUDED.popular_rating_count,
    peer_rating_avg = EXCLUDED.peer_rating_avg,
    peer_rating_count = EXCLUDED.peer_rating_count,
    updated_at = EXCLUDED.updated_at;
END;
$$;
