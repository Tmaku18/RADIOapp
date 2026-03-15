-- Web Discover Audio Swipe: clip metadata + swipe telemetry + liked list

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS discover_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS discover_clip_url TEXT,
  ADD COLUMN IF NOT EXISTS discover_clip_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS discover_clip_start_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS discover_clip_end_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS discover_background_url TEXT;

ALTER TABLE songs
  DROP CONSTRAINT IF EXISTS songs_discover_clip_duration_max_15;
ALTER TABLE songs
  ADD CONSTRAINT songs_discover_clip_duration_max_15
  CHECK (
    discover_clip_duration_seconds IS NULL
    OR (
      discover_clip_duration_seconds > 0
      AND discover_clip_duration_seconds <= 15
    )
  );

CREATE TABLE IF NOT EXISTS discover_swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('left_skip', 'right_like')),
  decision_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_discover_swipes_artist_created
  ON discover_swipes(artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discover_swipes_song_created
  ON discover_swipes(song_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discover_swipes_user_created
  ON discover_swipes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS discover_song_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_discover_song_likes_user_created
  ON discover_song_likes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discover_song_likes_artist_created
  ON discover_song_likes(artist_id, created_at DESC);
