-- Discover swipe telemetry + liked list (035 was not applied on production).

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
