-- Add explicit-content labeling support for songs.

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS is_explicit boolean NOT NULL DEFAULT false;

-- Index to speed up clean-station filtering.
CREATE INDEX IF NOT EXISTS idx_songs_status_explicit
  ON public.songs (status, is_explicit);
