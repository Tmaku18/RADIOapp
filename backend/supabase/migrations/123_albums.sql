-- Artist albums: optional grouping for discography display.
-- Songs remain the unit for radio, sales, samples, and approval.

CREATE TABLE IF NOT EXISTS public.albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'album'
    CHECK (release_type IN ('single', 'ep', 'album', 'mixtape')),
  artwork_url TEXT,
  release_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_albums_artist_created
  ON public.albums (artist_id, created_at DESC);

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES public.albums(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS track_number INTEGER;

CREATE INDEX IF NOT EXISTS idx_songs_album_track
  ON public.songs (album_id, track_number)
  WHERE album_id IS NOT NULL;

-- Owner-scoped read; Nest service role handles writes and public profile reads.
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Artists read own albums" ON public.albums;
CREATE POLICY "Artists read own albums"
  ON public.albums FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid())::text = (
      SELECT firebase_uid FROM public.users WHERE id = artist_id
    )
  );
