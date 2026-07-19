-- Automatic lyrics alignment (closed captions).
-- Tracks the state of the background job that force-aligns artist-provided
-- lyrics text to the song audio (timed_lines) via a managed provider.
--   none    - no alignment requested (e.g. manual timed_lines or no lyrics)
--   pending - alignment queued/in-flight
--   ready   - timed_lines were produced by the aligner
--   failed  - alignment errored; plain_text is still usable

ALTER TABLE song_lyrics
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE song_lyrics
  ADD COLUMN IF NOT EXISTS aligned_at TIMESTAMPTZ;

ALTER TABLE song_lyrics
  ADD COLUMN IF NOT EXISTS error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'song_lyrics_status_check'
  ) THEN
    ALTER TABLE song_lyrics
      ADD CONSTRAINT song_lyrics_status_check
      CHECK (status IN ('none', 'pending', 'ready', 'failed'));
  END IF;
END $$;

-- Rows that already have timed lines were synced manually or by a prior run.
UPDATE song_lyrics SET status = 'ready'
WHERE timed_lines IS NOT NULL AND status = 'none';
