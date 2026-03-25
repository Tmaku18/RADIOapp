-- Persisted global song temperature cache.
-- Keeps fire/shit reaction totals per song in a globally readable table.
-- UUID-safe for environments where songs.id is uuid.

CREATE TABLE IF NOT EXISTS public.song_temperature (
  song_id uuid PRIMARY KEY,
  fire_votes integer NOT NULL DEFAULT 0,
  shit_votes integer NOT NULL DEFAULT 0,
  total_votes integer NOT NULL DEFAULT 0,
  temperature_percent integer NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
  temp_percent := CASE
    WHEN total_count > 0 THEN ROUND((fire_count::numeric / total_count::numeric) * 100)::integer
    ELSE 50
  END;

  INSERT INTO public.song_temperature (
    song_id,
    fire_votes,
    shit_votes,
    total_votes,
    temperature_percent,
    updated_at
  )
  VALUES (
    p_song_id,
    fire_count,
    shit_count,
    total_count,
    temp_percent,
    now()
  )
  ON CONFLICT (song_id)
  DO UPDATE SET
    fire_votes = EXCLUDED.fire_votes,
    shit_votes = EXCLUDED.shit_votes,
    total_votes = EXCLUDED.total_votes,
    temperature_percent = EXCLUDED.temperature_percent,
    updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_song_temperature_from_leaderboard_like()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_song_temperature(OLD.song_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_song_temperature(NEW.song_id);

  IF TG_OP = 'UPDATE' AND OLD.song_id IS DISTINCT FROM NEW.song_id THEN
    PERFORM public.refresh_song_temperature(OLD.song_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_song_temperature ON public.leaderboard_likes;

CREATE TRIGGER trg_refresh_song_temperature
AFTER INSERT OR UPDATE OR DELETE ON public.leaderboard_likes
FOR EACH ROW
EXECUTE FUNCTION public.refresh_song_temperature_from_leaderboard_like();

-- Backfill existing songs with current global reaction totals.
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

CREATE INDEX IF NOT EXISTS idx_song_temperature_updated_at
  ON public.song_temperature(updated_at DESC);
