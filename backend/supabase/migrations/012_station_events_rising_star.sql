-- Station-wide events for realtime listeners (e.g., Rising Star alerts)

CREATE TABLE IF NOT EXISTS station_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT NOT NULL DEFAULT 'global',
  type TEXT NOT NULL CHECK (type IN ('rising_star')),
  play_id UUID REFERENCES plays(id) ON DELETE SET NULL,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate Rising Star spam per play
CREATE UNIQUE INDEX IF NOT EXISTS uniq_station_events_type_play
  ON station_events(type, play_id);

CREATE INDEX IF NOT EXISTS idx_station_events_station_created_at
  ON station_events(station_id, created_at DESC);

