-- Allow songs to be assigned to multiple stations.
-- Keep station_id for backward compatibility; station_ids is additive.

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS station_ids text[];

-- Backfill station_ids from existing station_id values.
UPDATE public.songs
SET station_ids = ARRAY[station_id]
WHERE station_id IS NOT NULL
  AND (station_ids IS NULL OR array_length(station_ids, 1) IS NULL);

-- Helpful index for station_ids containment queries.
CREATE INDEX IF NOT EXISTS idx_songs_station_ids_gin
  ON public.songs USING gin (station_ids);

