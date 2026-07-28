-- Feed posts can now carry audio: either as a soundtrack behind a picture, or
-- audio-only (clients fall back to the Networx Radio logo as cover art).
--
-- image_url stays NOT NULL and holds the cover art for audio posts, so every
-- existing surface (search tiles, explore grid, DM shares, admin reports)
-- keeps rendering without changes.

ALTER TABLE discover_feed_posts
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

COMMENT ON COLUMN discover_feed_posts.audio_url IS
  'Public URL of the post audio track. NULL for plain image/video posts.';

-- Raise the feed bucket to 200MB and allow audio uploads alongside images/video.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed',
  'feed',
  true,
  209715200, -- 200MB
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/aac',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/ogg',
    'audio/flac'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
