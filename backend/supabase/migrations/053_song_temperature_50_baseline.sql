-- Song temperature: 50% baseline, +1% per fire, -1% per shit (no decay).
-- Reset all existing temperature rows.

ALTER TABLE public.song_temperature
  ALTER COLUMN temperature_percent SET DEFAULT 50;

CREATE OR REPLACE FUNCTION public.refresh_song_temperature(p_song_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  fire_count integer := 0;
  shit_count integer := 0;
  total_count integer := 0;
  temp_percent integer := 50;
BEGIN
  IF p_song_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN reaction = 'fire' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN reaction = 'shit' THEN 1 ELSE 0 END), 0)
  INTO fire_count, shit_count
  FROM public.leaderboard_likes
  WHERE song_id = p_song_id;

  total_count := fire_count + shit_count;

  -- Baseline 50%, +1 per fire, -1 per shit, clamped [0, 100]
  temp_percent := GREATEST(0, LEAST(100, 50 + fire_count - shit_count));

  INSERT INTO public.song_temperature (
    song_id,
    fire_votes,
    shit_votes,
    total_votes,
    decayed_fire_votes,
    decayed_shit_votes,
    temperature_percent,
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
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- Reset all existing temperature cache rows to 50% and zero votes.
UPDATE public.song_temperature
SET
  fire_votes = 0,
  shit_votes = 0,
  total_votes = 0,
  decayed_fire_votes = 0,
  decayed_shit_votes = 0,
  temperature_percent = 50,
  updated_at = now();

-- Clear all existing leaderboard_likes so temperature starts fresh.
DELETE FROM public.leaderboard_likes;
