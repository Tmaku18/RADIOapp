-- Global persistent song temperature with exponential time decay.
-- Requirements:
-- - Temperature starts at 0 for all songs.
-- - Each fresh fire vote contributes +1, each fresh shit vote contributes -1.
-- - Contributions naturally decay over time (half-life).
-- - Votes remain persisted in leaderboard_likes for ranking/history.

ALTER TABLE public.song_temperature
  ADD COLUMN IF NOT EXISTS decayed_fire_votes numeric(14, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS decayed_shit_votes numeric(14, 4) NOT NULL DEFAULT 0;

ALTER TABLE public.song_temperature
  ALTER COLUMN temperature_percent SET DEFAULT 0;

UPDATE public.song_temperature
SET temperature_percent = 0
WHERE total_votes = 0;

CREATE OR REPLACE FUNCTION public.refresh_song_temperature(p_song_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  half_life_hours numeric := 24; -- natural half-life window
  half_life_seconds numeric := half_life_hours * 3600;
  fire_count integer := 0;
  shit_count integer := 0;
  total_count integer := 0;
  decayed_fire numeric := 0;
  decayed_shit numeric := 0;
  temp_percent integer := 0;
BEGIN
  IF p_song_id IS NULL OR length(trim(p_song_id)) = 0 THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN reaction = 'fire' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN reaction = 'shit' THEN 1 ELSE 0 END), 0),
    COALESCE(
      SUM(
        CASE
          WHEN reaction = 'fire'
            THEN power(
              0.5::numeric,
              EXTRACT(EPOCH FROM (now() - COALESCE(created_at, now())))::numeric / half_life_seconds
            )
          ELSE 0::numeric
        END
      ),
      0
    ),
    COALESCE(
      SUM(
        CASE
          WHEN reaction = 'shit'
            THEN power(
              0.5::numeric,
              EXTRACT(EPOCH FROM (now() - COALESCE(created_at, now())))::numeric / half_life_seconds
            )
          ELSE 0::numeric
        END
      ),
      0
    )
  INTO fire_count, shit_count, decayed_fire, decayed_shit
  FROM public.leaderboard_likes
  WHERE song_id = p_song_id;

  total_count := fire_count + shit_count;

  -- 1 vote ~= 1 percentage point at vote time, with natural decay.
  temp_percent := GREATEST(
    0,
    LEAST(100, ROUND(decayed_fire - decayed_shit)::integer)
  );

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
    ROUND(decayed_fire, 4),
    ROUND(decayed_shit, 4),
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

-- Recompute existing cache rows with decay + zero-baseline logic.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT DISTINCT song_id
    FROM public.leaderboard_likes
    WHERE song_id IS NOT NULL
  LOOP
    PERFORM public.refresh_song_temperature(rec.song_id);
  END LOOP;
END $$;
