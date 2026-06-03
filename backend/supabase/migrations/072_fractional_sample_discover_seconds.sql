-- Allow half-second precision for sample and Discover clip windows.
-- The trim editors nudge by 0.5s, so these second columns must hold fractions.
-- Use double precision (float8) so PostgREST returns JSON numbers, not strings.
ALTER TABLE songs
  ALTER COLUMN sample_start_seconds TYPE double precision,
  ALTER COLUMN sample_end_seconds TYPE double precision,
  ALTER COLUMN discover_clip_start_seconds TYPE double precision,
  ALTER COLUMN discover_clip_end_seconds TYPE double precision,
  ALTER COLUMN discover_clip_duration_seconds TYPE double precision;
