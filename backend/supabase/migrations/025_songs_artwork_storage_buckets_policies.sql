-- Ensure songs and artwork storage buckets exist and allow uploads via signed URLs.
-- Without RLS policies on storage.objects, uploads return "forbidden resource".

-- 1) Create or update buckets (songs: 100MB, artwork: 5MB; both public for read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'songs',
  'songs',
  true,
  104857600,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artwork',
  'artwork',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) RLS policies on storage.objects so signed-url uploads (PUT) succeed.
-- Signed URLs are generated server-side with service role; the client PUT may be treated as anon.
-- Grant INSERT for songs and artwork buckets so uploads are allowed.

DROP POLICY IF EXISTS "Allow uploads to songs bucket" ON storage.objects;
CREATE POLICY "Allow uploads to songs bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'songs');

DROP POLICY IF EXISTS "Allow uploads to artwork bucket" ON storage.objects;
CREATE POLICY "Allow uploads to artwork bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'artwork');

-- 3) Public read for songs and artwork (buckets are public)
DROP POLICY IF EXISTS "Public read for songs bucket" ON storage.objects;
CREATE POLICY "Public read for songs bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'songs');

DROP POLICY IF EXISTS "Public read for artwork bucket" ON storage.objects;
CREATE POLICY "Public read for artwork bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'artwork');
