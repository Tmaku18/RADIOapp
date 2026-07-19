-- Each radio has its own free and paid playlist state and fallback playlist.
-- Default radio_id = 'default' preserves existing single-radio behavior.

-- 1) admin_fallback_songs: free rotation playlist per radio
ALTER TABLE admin_fallback_songs
  ADD COLUMN IF NOT EXISTS radio_id TEXT NOT NULL DEFAULT 'default';

UPDATE admin_fallback_songs SET radio_id = 'default' WHERE radio_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_fallback_songs_radio_id ON admin_fallback_songs(radio_id);

COMMENT ON COLUMN admin_fallback_songs.radio_id IS 'Radio/station identifier. Each radio has its own free rotation playlist.';

-- 2) radio_playlist_state: playlist type and free-rotation stack/position per radio
ALTER TABLE radio_playlist_state
  ADD COLUMN IF NOT EXISTS radio_id TEXT NOT NULL DEFAULT 'default';

UPDATE radio_playlist_state SET radio_id = 'default' WHERE radio_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_radio_playlist_state_radio_id ON radio_playlist_state(radio_id);

COMMENT ON COLUMN radio_playlist_state.radio_id IS 'Radio/station identifier. Each radio has its own playlist_type, fallback_stack, and fallback_position.';

-- 3) rotation_queue: current-playing state per radio (DB fallback when Redis unavailable)
ALTER TABLE rotation_queue
  ADD COLUMN IF NOT EXISTS radio_id TEXT NOT NULL DEFAULT 'default';

UPDATE rotation_queue SET radio_id = 'default' WHERE radio_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_rotation_queue_radio_id ON rotation_queue(radio_id);

COMMENT ON COLUMN rotation_queue.radio_id IS 'Radio/station identifier for scoping current track state.';
