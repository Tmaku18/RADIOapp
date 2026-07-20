-- Listener preference: notify when a followed artist's song plays on radio.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notify_followed_artist_on_radio boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.notify_followed_artist_on_radio IS
  'When true, send push/in-app alerts when a followed artist is about to play or is on radio.';
