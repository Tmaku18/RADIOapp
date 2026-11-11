-- Clips posted as stories for a song. Public ones are readable on the radio
-- while that song plays. They expire after 24 hours.
-- The API uses the service role. RLS stays on with no client policies so the
-- Data API cannot read or write this table directly.

CREATE TABLE IF NOT EXISTS public.song_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_mime text,
  caption text,
  visibility text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT song_stories_visibility_check CHECK (visibility IN ('public', 'private')),
  CONSTRAINT song_stories_caption_len CHECK (caption IS NULL OR char_length(caption) <= 280)
);

CREATE INDEX IF NOT EXISTS idx_song_stories_song_live
  ON public.song_stories (song_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_song_stories_user
  ON public.song_stories (user_id, created_at DESC);

ALTER TABLE public.song_stories ENABLE ROW LEVEL SECURITY;
