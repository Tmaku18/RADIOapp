-- Track active radio listeners independent of auth heartbeat.
-- This enables accurate live listener counts for admin, logged-in, and guest listeners.

CREATE TABLE IF NOT EXISTS radio_listener_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_token TEXT NOT NULL,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stream_token, song_id)
);

CREATE INDEX IF NOT EXISTS idx_radio_listener_presence_song_seen
  ON radio_listener_presence(song_id, last_seen_at DESC);
