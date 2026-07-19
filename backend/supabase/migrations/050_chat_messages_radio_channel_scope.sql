-- Scope chat streams by radio channel (genre/station).
-- Existing messages default to global.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS radio_id text;

UPDATE public.chat_messages
SET radio_id = 'global'
WHERE radio_id IS NULL OR btrim(radio_id) = '';

ALTER TABLE public.chat_messages
  ALTER COLUMN radio_id SET DEFAULT 'global';

ALTER TABLE public.chat_messages
  ALTER COLUMN radio_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_radio_created_at
  ON public.chat_messages(radio_id, created_at DESC);

ALTER TABLE public.chat_archives
  ADD COLUMN IF NOT EXISTS radio_id text;

UPDATE public.chat_archives
SET radio_id = 'global'
WHERE radio_id IS NULL OR btrim(radio_id) = '';

ALTER TABLE public.chat_archives
  ALTER COLUMN radio_id SET DEFAULT 'global';

CREATE INDEX IF NOT EXISTS idx_chat_archives_radio_created
  ON public.chat_archives(radio_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.archive_old_chat_messages(
  cutoff_timestamp timestamptz
)
RETURNS integer AS $$
DECLARE archived_count integer;
BEGIN
  INSERT INTO public.chat_archives (
    id,
    user_id,
    song_id,
    radio_id,
    display_name,
    avatar_url,
    message,
    created_at
  )
  SELECT
    id,
    user_id,
    song_id,
    COALESCE(NULLIF(btrim(radio_id), ''), 'global'),
    display_name,
    avatar_url,
    message,
    created_at
  FROM public.chat_messages
  WHERE created_at < cutoff_timestamp AND deleted_at IS NULL;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
