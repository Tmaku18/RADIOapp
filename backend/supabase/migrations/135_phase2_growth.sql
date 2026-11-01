-- Phase 2: trigram search, referral codes, notification quiet hours, listening history.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS notify_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_live boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_weekly_digest boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_start smallint,
  ADD COLUMN IF NOT EXISTS quiet_hours_end smallint;

CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_uidx
  ON public.users (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS songs_title_trgm
  ON public.songs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS songs_artist_name_trgm
  ON public.songs USING gin (artist_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_display_name_trgm
  ON public.users USING gin (display_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.listening_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  song_id uuid,
  title text,
  artist_name text,
  artwork_url text,
  played_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listening_history_user_played
  ON public.listening_history (user_id, played_at DESC);

ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;

-- Ranked catalog search. Trigram similarity leads; ILIKE covers short queries.
CREATE OR REPLACE FUNCTION public.search_catalog(p_query text, p_limit int DEFAULT 12)
RETURNS TABLE (
  kind text,
  id uuid,
  title text,
  subtitle text,
  image_url text
)
LANGUAGE sql
STABLE
AS $$
  WITH q AS (
    SELECT lower(btrim(p_query)) AS term
  )
  SELECT kind, id, title, subtitle, image_url FROM (
    SELECT
      'song'::text AS kind,
      s.id,
      s.title,
      COALESCE(s.artist_name, '') AS subtitle,
      s.artwork_url AS image_url,
      greatest(
        similarity(lower(s.title), q.term),
        similarity(lower(COALESCE(s.artist_name, '')), q.term)
      ) AS score
    FROM public.songs s, q
    WHERE char_length(q.term) >= 2
      AND COALESCE(s.status, 'approved') = 'approved'
      AND (
        lower(s.title) % q.term
        OR lower(COALESCE(s.artist_name, '')) % q.term
        OR s.title ILIKE '%' || q.term || '%'
        OR s.artist_name ILIKE '%' || q.term || '%'
      )
    ORDER BY score DESC
    LIMIT p_limit
  ) songs
  UNION ALL
  SELECT kind, id, title, subtitle, image_url FROM (
    SELECT
      'user'::text AS kind,
      u.id,
      COALESCE(u.display_name, u.username, 'Listener') AS title,
      COALESCE(u.username, u.role, '') AS subtitle,
      u.avatar_url AS image_url,
      greatest(
        similarity(lower(COALESCE(u.display_name, '')), q.term),
        similarity(lower(COALESCE(u.username, '')), q.term)
      ) AS score
    FROM public.users u, q
    WHERE char_length(q.term) >= 2
      AND COALESCE(u.is_banned, false) = false
      AND (
        lower(COALESCE(u.display_name, '')) % q.term
        OR lower(COALESCE(u.username, '')) % q.term
        OR u.display_name ILIKE '%' || q.term || '%'
        OR u.username ILIKE '%' || q.term || '%'
      )
    ORDER BY score DESC
    LIMIT p_limit
  ) people;
$$;
