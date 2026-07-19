-- Auto-generated captions (speech-to-text fallback).
-- When a song has no artist-provided lyrics, the backend can transcribe the
-- audio (ElevenLabs Scribe) and store the result as auto-generated captions.
-- The flag lets clients label them and artists review/correct them; saving
-- artist lyrics clears it.

ALTER TABLE song_lyrics
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false;
