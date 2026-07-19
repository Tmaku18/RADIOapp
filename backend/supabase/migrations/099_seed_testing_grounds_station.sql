-- Seed Testing Grounds Radio fallback playlist from Ready Now so the station
-- has free-rotation content for QA and staging. Idempotent: safe to re-run.

INSERT INTO admin_fallback_songs (
  radio_id,
  title,
  artist_name,
  audio_url,
  artwork_url,
  duration_seconds,
  is_active,
  created_at,
  updated_at
)
SELECT
  'us-testing-grounds',
  title,
  artist_name,
  audio_url,
  artwork_url,
  duration_seconds,
  is_active,
  created_at,
  updated_at
FROM admin_fallback_songs
WHERE radio_id = 'us-ready-now-rap'
  AND NOT EXISTS (
    SELECT 1 FROM admin_fallback_songs b2
    WHERE b2.radio_id = 'us-testing-grounds'
      AND b2.title = admin_fallback_songs.title
      AND b2.artist_name = admin_fallback_songs.artist_name
      AND b2.audio_url = admin_fallback_songs.audio_url
  );
