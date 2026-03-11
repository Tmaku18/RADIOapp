-- Copy existing default fallback songs to the Rap radio (ga-nw-rap) so both radios have the same free-rotation content.
-- Run after 027_radio_id_per_radio_playlists.sql.

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
  'ga-nw-rap',
  title,
  artist_name,
  audio_url,
  artwork_url,
  duration_seconds,
  is_active,
  created_at,
  updated_at
FROM admin_fallback_songs
WHERE radio_id = 'default'
  AND NOT EXISTS (
    SELECT 1 FROM admin_fallback_songs b2
    WHERE b2.radio_id = 'ga-nw-rap'
      AND b2.title = admin_fallback_songs.title
      AND b2.artist_name = admin_fallback_songs.artist_name
      AND b2.audio_url = admin_fallback_songs.audio_url
  );
