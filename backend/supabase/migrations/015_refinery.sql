-- Migration: The Refinery
-- Portal where artists submit songs for review; Prospectors (listeners who signed up)
-- listen unlimited, answer surveys, rank, and comment for rewards. Regular listeners
-- do not have access.

-- ---------------------------------------------------------------------------
-- 1) Songs in the Refinery (artist-selectable)
-- ---------------------------------------------------------------------------
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS in_refinery BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_songs_in_refinery ON songs(in_refinery, created_at DESC)
  WHERE in_refinery = TRUE;

COMMENT ON COLUMN songs.in_refinery IS 'Artist opted this song into The Refinery for Prospector review (rank, survey, comments).';

-- ---------------------------------------------------------------------------
-- 2) Refinery comments (Prospector comments on refinery songs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refinery_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refinery_comments_song ON refinery_comments(song_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refinery_comments_user ON refinery_comments(user_id, created_at DESC);

COMMENT ON TABLE refinery_comments IS 'Prospector comments on songs in The Refinery.';

-- RLS (Firebase uid in JWT "sub")
ALTER TABLE refinery_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read refinery comments" ON refinery_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Prospectors can create refinery comments" ON refinery_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub')
  );

CREATE POLICY "Users can update own refinery comments" ON refinery_comments
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'));

CREATE POLICY "Users can delete own refinery comments" ON refinery_comments
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'));

CREATE POLICY "Service role can manage refinery_comments" ON refinery_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
