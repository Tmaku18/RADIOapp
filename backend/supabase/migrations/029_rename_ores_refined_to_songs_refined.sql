-- Rename ores_refined_count to songs_refined_count (terminology: ores → songs)
ALTER TABLE prospector_yield
  RENAME COLUMN ores_refined_count TO songs_refined_count;
