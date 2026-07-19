-- Saved posts: users can bookmark discover_feed_posts to revisit later.
-- Mirrors discover_feed_post_likes (see 062_feed_post_engagement.sql).

CREATE TABLE IF NOT EXISTS discover_feed_post_bookmarks (
  post_id UUID NOT NULL REFERENCES discover_feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_discover_feed_post_bookmarks_post
  ON discover_feed_post_bookmarks(post_id);
-- Drives the "Saved" screen ordered by most-recently bookmarked.
CREATE INDEX IF NOT EXISTS idx_discover_feed_post_bookmarks_user
  ON discover_feed_post_bookmarks(user_id, created_at DESC);

ALTER TABLE discover_feed_post_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own feed post bookmarks"
  ON discover_feed_post_bookmarks FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = (SELECT firebase_uid FROM users WHERE id = user_id)
  );

CREATE POLICY "Users bookmark as themselves"
  ON discover_feed_post_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = (SELECT firebase_uid FROM users WHERE id = user_id)
  );

CREATE POLICY "Users remove own feed post bookmarks"
  ON discover_feed_post_bookmarks FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = (SELECT firebase_uid FROM users WHERE id = user_id)
  );
