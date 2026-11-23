-- Listener 1–10 ratings on radio songs (separate from 🔥 / 💩 temperature votes).

CREATE TABLE IF NOT EXISTS public.song_listener_ratings (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id),
  CONSTRAINT song_listener_ratings_range
    CHECK (rating >= 1 AND rating <= 10)
);

CREATE INDEX IF NOT EXISTS idx_song_listener_ratings_song
  ON public.song_listener_ratings (song_id);

CREATE INDEX IF NOT EXISTS idx_song_listener_ratings_user_updated
  ON public.song_listener_ratings (user_id, updated_at DESC);

-- Backend uses the service role (bypasses RLS). No direct client writes.
ALTER TABLE public.song_listener_ratings ENABLE ROW LEVEL SECURITY;
