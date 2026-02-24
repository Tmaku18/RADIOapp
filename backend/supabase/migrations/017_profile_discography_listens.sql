-- Migration: Profile discography listens (Spotify-like)
--
-- Adds a separate listen counter for on-profile playback, so "discoveries"
-- can combine radio plays (songs.play_count) + profile listens (songs.profile_play_count).

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS profile_play_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_songs_profile_play_count
  ON songs(profile_play_count DESC) WHERE profile_play_count > 0;

CREATE TABLE IF NOT EXISTS song_profile_listens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_song_profile_listens_song
  ON song_profile_listens(song_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_song_profile_listens_artist_time
  ON song_profile_listens(artist_id, created_at DESC);

-- Trigger: increment songs.profile_play_count on insert
CREATE OR REPLACE FUNCTION increment_profile_play_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE songs
  SET profile_play_count = COALESCE(profile_play_count, 0) + 1
  WHERE id = NEW.song_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_song_profile_listens_increment ON song_profile_listens;
CREATE TRIGGER trg_song_profile_listens_increment
  AFTER INSERT ON song_profile_listens
  FOR EACH ROW EXECUTE FUNCTION increment_profile_play_count();

