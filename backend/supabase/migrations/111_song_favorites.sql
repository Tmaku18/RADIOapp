-- Song favorites (⭐): separate from likes (🔥).
-- Radio on-air / up-next push alerts fan out to song_favorites only.
-- Do NOT backfill from likes — favorites start empty until the user stars.

CREATE TABLE IF NOT EXISTS public.song_favorites (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_song_favorites_song
  ON public.song_favorites (song_id);

CREATE INDEX IF NOT EXISTS idx_song_favorites_user_created
  ON public.song_favorites (user_id, created_at DESC);

-- Backend uses the service role (bypasses RLS). No direct client writes.
ALTER TABLE public.song_favorites ENABLE ROW LEVEL SECURITY;
