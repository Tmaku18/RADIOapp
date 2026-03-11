-- Explicit anon SELECT so unauthenticated requests (e.g. browser loading artwork/audio URLs) can read.
-- "Forbidden resource" when viewing My Ores is often from img/audio requests to Storage as anon.

DROP POLICY IF EXISTS "Anon read songs bucket" ON storage.objects;
CREATE POLICY "Anon read songs bucket"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'songs');

DROP POLICY IF EXISTS "Anon read artwork bucket" ON storage.objects;
CREATE POLICY "Anon read artwork bucket"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'artwork');
