-- Song lyrics: plain text + timed lines for synced display.
-- timed_lines is a JSONB array of { "startMs": 12340, "endMs": 16500, "text": "line…" }

CREATE TABLE IF NOT EXISTS song_lyrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id     UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  plain_text  TEXT,
  timed_lines JSONB,
  provider    TEXT,
  provider_track_id TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (song_id)
);

CREATE INDEX IF NOT EXISTS idx_song_lyrics_song_id ON song_lyrics(song_id);

-- RLS: public read, admin/artist write (handled in app layer).
ALTER TABLE song_lyrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read lyrics"
  ON song_lyrics FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage lyrics"
  ON song_lyrics FOR ALL
  USING (true)
  WITH CHECK (true);
