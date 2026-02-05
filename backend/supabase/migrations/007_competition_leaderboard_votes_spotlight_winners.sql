-- Leaderboard likes (one per user per play)
CREATE TABLE IF NOT EXISTS leaderboard_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  play_id UUID REFERENCES plays(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_likes_user_play ON leaderboard_likes(user_id, play_id) WHERE play_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leaderboard_likes_song ON leaderboard_likes(song_id);

-- Weekly votes (rank 1-7 per user per week; ISO week Monday-Sunday)
CREATE TABLE IF NOT EXISTS weekly_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start_date DATE NOT NULL,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start_date, rank)
);
CREATE INDEX IF NOT EXISTS idx_weekly_votes_period ON weekly_votes(period_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_votes_song ON weekly_votes(period_start_date, song_id);

-- Artist spotlight (one per day) and winners
CREATE TABLE IF NOT EXISTS artist_spotlight (
  date DATE PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'weekly_winner' CHECK (source IN ('weekly_winner', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS weekly_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start_date DATE NOT NULL UNIQUE,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS monthly_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);
CREATE TABLE IF NOT EXISTS yearly_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spotlight listens and news_promotions
CREATE TABLE IF NOT EXISTS spotlight_listens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('featured_replay', 'artist_of_week', 'artist_of_month')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spotlight_listens_song ON spotlight_listens(song_id);
CREATE INDEX IF NOT EXISTS idx_spotlight_listens_artist_source ON spotlight_listens(artist_id, source);

CREATE TABLE IF NOT EXISTS news_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('news', 'promotion')),
  title TEXT NOT NULL,
  body_or_description TEXT,
  image_url TEXT,
  link_url TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_promotions_active_dates ON news_promotions(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_news_promotions_sort ON news_promotions(sort_order);

-- Trigger: increment songs.spotlight_listen_count on insert
CREATE OR REPLACE FUNCTION increment_spotlight_listen_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE songs SET spotlight_listen_count = COALESCE(spotlight_listen_count, 0) + 1 WHERE id = NEW.song_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_spotlight_listens_increment ON spotlight_listens;
CREATE TRIGGER trg_spotlight_listens_increment
  AFTER INSERT ON spotlight_listens
  FOR EACH ROW EXECUTE FUNCTION increment_spotlight_listen_count();
