-- Pro Networks resume convenience: mirror resume fields onto public.users so
-- the backend can read/write through PostgREST without cross-schema exposure.
-- The same data also lives on pro_networx.profiles for legacy compatibility.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS resume_filename TEXT;

COMMENT ON COLUMN public.users.resume_url IS 'Path or signed URL to the PDF resume in the resumes bucket.';
COMMENT ON COLUMN public.users.resume_filename IS 'Original uploaded filename.';
