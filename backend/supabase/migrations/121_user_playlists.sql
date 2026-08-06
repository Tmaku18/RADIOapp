-- Personal playlists for Pro-Radio subscribers (Spotify-like listening).

CREATE TABLE IF NOT EXISTS public.user_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_playlists_user
  ON public.user_playlists(user_id);

CREATE TABLE IF NOT EXISTS public.user_playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.user_playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (playlist_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_user_playlist_tracks_playlist
  ON public.user_playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_user_playlist_tracks_song
  ON public.user_playlist_tracks(song_id);
