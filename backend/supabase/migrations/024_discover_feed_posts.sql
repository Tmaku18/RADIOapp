-- Discover feed: catalyst (service provider) posts shown in Discover tab (Instagram-style feed)
CREATE TABLE IF NOT EXISTS discover_feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discover_feed_posts_created_at ON discover_feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discover_feed_posts_author ON discover_feed_posts(author_user_id);

-- RLS: allow read for authenticated; insert/update/delete only for author (enforced in app; optional RLS policies can be added later)
ALTER TABLE discover_feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Discover feed posts are viewable by authenticated users"
  ON discover_feed_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own discover feed posts"
  ON discover_feed_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = (SELECT firebase_uid FROM users WHERE id = author_user_id));

CREATE POLICY "Users can update own discover feed posts"
  ON discover_feed_posts FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = (SELECT firebase_uid FROM users WHERE id = author_user_id));

CREATE POLICY "Users can delete own discover feed posts"
  ON discover_feed_posts FOR DELETE
  TO authenticated
  USING (auth.uid()::text = (SELECT firebase_uid FROM users WHERE id = author_user_id));

-- Storage bucket for discover feed images (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed',
  'feed',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
