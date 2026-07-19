-- Competition: users region, suggest_local_artists, bio; songs spotlight_listen_count
ALTER TABLE users ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suggest_local_artists BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
CREATE INDEX IF NOT EXISTS idx_users_region ON users(region) WHERE region IS NOT NULL;

ALTER TABLE songs ADD COLUMN IF NOT EXISTS spotlight_listen_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_songs_spotlight_listen_count ON songs(spotlight_listen_count DESC) WHERE spotlight_listen_count > 0;
