-- Favorite artists: separate from follow. Radio now-playing / up-next
-- push alerts fan out to favorites only (follow stays for social graph).

CREATE TABLE IF NOT EXISTS public.artist_favorites (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist_id),
  CONSTRAINT artist_favorites_no_self CHECK (user_id <> artist_id)
);

CREATE INDEX IF NOT EXISTS idx_artist_favorites_artist
  ON public.artist_favorites (artist_id);

CREATE INDEX IF NOT EXISTS idx_artist_favorites_user
  ON public.artist_favorites (user_id);

-- Backend uses the service role (bypasses RLS). No direct client writes.
ALTER TABLE public.artist_favorites ENABLE ROW LEVEL SECURITY;
