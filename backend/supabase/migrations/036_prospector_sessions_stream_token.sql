-- Track unique listening sessions per device/tab for accurate listener counts.
-- This allows one account listening in multiple places to contribute multiple
-- active listeners while preserving existing user-level session behavior.

ALTER TABLE prospector_sessions
ADD COLUMN IF NOT EXISTS stream_token TEXT;

CREATE INDEX IF NOT EXISTS idx_prospector_sessions_user_stream_active
  ON prospector_sessions(user_id, stream_token, ended_at)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prospector_sessions_song_hb
  ON prospector_sessions(song_id, last_heartbeat_at DESC);

COMMENT ON COLUMN prospector_sessions.stream_token IS
  'Client stream/session identifier for distinguishing concurrent listeners by device/tab.';
