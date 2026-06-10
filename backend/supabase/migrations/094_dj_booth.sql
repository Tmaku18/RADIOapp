-- DJ Booth: station mic sessions and admin soundboard clips

CREATE TABLE IF NOT EXISTS dj_booth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT NOT NULL,
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  cloudflare_uid TEXT,
  whip_url TEXT,
  hls_playback_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dj_booth_sessions_station_active
  ON dj_booth_sessions(station_id, status)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS dj_soundboard_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dj_soundboard_clips_created
  ON dj_soundboard_clips(created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dj-soundboard',
  'dj-soundboard',
  true,
  5242880,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
