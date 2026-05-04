-- Pro Networks feed engagement: likes + comments on discover_feed_posts.
-- Both surfaces (the Networks Radio social tab and the Pro Networks Home tab)
-- read from discover_feed_posts; this migration adds the social engagement
-- tables that drive the heart and comment buttons.

CREATE TABLE IF NOT EXISTS discover_feed_post_likes (
  post_id UUID NOT NULL REFERENCES discover_feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_discover_feed_post_likes_post
  ON discover_feed_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_discover_feed_post_likes_user
  ON discover_feed_post_likes(user_id);

ALTER TABLE discover_feed_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read feed post likes"
  ON discover_feed_post_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users like as themselves"
  ON discover_feed_post_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = (SELECT firebase_uid FROM users WHERE id = user_id)
  );

CREATE POLICY "Users unlike as themselves"
  ON discover_feed_post_likes FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = (SELECT firebase_uid FROM users WHERE id = user_id)
  );

CREATE TABLE IF NOT EXISTS discover_feed_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES discover_feed_posts(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_discover_feed_post_comments_post
  ON discover_feed_post_comments(post_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_discover_feed_post_comments_author
  ON discover_feed_post_comments(author_user_id);

ALTER TABLE discover_feed_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read feed post comments"
  ON discover_feed_post_comments FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Users insert own feed post comments"
  ON discover_feed_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = (SELECT firebase_uid FROM users WHERE id = author_user_id)
  );

CREATE POLICY "Users soft-delete own feed post comments"
  ON discover_feed_post_comments FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = (SELECT firebase_uid FROM users WHERE id = author_user_id)
  );
