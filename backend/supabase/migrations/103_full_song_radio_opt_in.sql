-- Per-song opt-in flags for full-song NETWORX Radio and DJ programming.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS opt_in_full_song_radio BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opt_in_dj_livestreams BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opt_in_dj_archived_mixes BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.songs.opt_in_full_song_radio IS
  'Artist accepted NETWORX Full-Song Radio Opt-In Agreement for non-interactive live radio streaming.';
COMMENT ON COLUMN public.songs.opt_in_dj_livestreams IS
  'Artist allows song use in NETWORX DJ livestreams and DJ mix stations.';
COMMENT ON COLUMN public.songs.opt_in_dj_archived_mixes IS
  'Artist allows song inclusion in recorded or archived DJ mixes.';
