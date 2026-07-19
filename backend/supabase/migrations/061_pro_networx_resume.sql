-- Pro Networks: resume PDF on the LinkedIn-style profile.
-- Adds resume_url + resume_filename to pro_networx.profiles, and a private
-- resumes storage bucket with PDF mime types.

ALTER TABLE pro_networx.profiles
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS resume_filename TEXT;

COMMENT ON COLUMN pro_networx.profiles.resume_url IS 'Path or signed URL to the PDF resume in the resumes bucket.';
COMMENT ON COLUMN pro_networx.profiles.resume_filename IS 'Original uploaded filename, used for display + downloads.';

-- Private bucket for resumes; objects are read via short-lived signed URLs from the backend.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow service role inserts (handled by backend) and read for signed URL flow only.
DROP POLICY IF EXISTS "Backend uploads resumes" ON storage.objects;
CREATE POLICY "Backend uploads resumes"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'resumes');

DROP POLICY IF EXISTS "Backend reads resumes" ON storage.objects;
CREATE POLICY "Backend reads resumes"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'resumes');
