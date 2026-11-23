-- Split station live chat from per-song comments.
-- Existing rows stay live chat.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS kind text;

UPDATE public.chat_messages
SET kind = 'live'
WHERE kind IS NULL OR btrim(kind) = '';

ALTER TABLE public.chat_messages
  ALTER COLUMN kind SET DEFAULT 'live';

ALTER TABLE public.chat_messages
  ALTER COLUMN kind SET NOT NULL;

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_kind_check;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_kind_check
  CHECK (kind IN ('live', 'comment'));

CREATE INDEX IF NOT EXISTS idx_chat_messages_song_comments
  ON public.chat_messages (song_id, created_at DESC)
  WHERE kind = 'comment';
