-- Migration: Daily Diamond snapshots for Trial-by-Fire windows
CREATE TABLE IF NOT EXISTS daily_diamonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  votes INTEGER NOT NULL DEFAULT 0 CHECK (votes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (window_start, window_end)
);

CREATE INDEX IF NOT EXISTS idx_daily_diamonds_window ON daily_diamonds(window_start DESC);
CREATE INDEX IF NOT EXISTS idx_daily_diamonds_song ON daily_diamonds(song_id, created_at DESC);

