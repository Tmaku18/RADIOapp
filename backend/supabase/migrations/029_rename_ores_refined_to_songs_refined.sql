-- Rename ores_refined_count to songs_refined_count (terminology: ores → songs).
-- Only runs if the old column exists (existing DBs); fresh installs already have songs_refined_count from 014.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prospector_yield' AND column_name = 'ores_refined_count'
  ) THEN
    ALTER TABLE prospector_yield RENAME COLUMN ores_refined_count TO songs_refined_count;
  END IF;
END $$;
