-- Profile edit: headline and location_region on users (discovery, profile page)
ALTER TABLE users ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_region TEXT;
CREATE INDEX IF NOT EXISTS idx_users_location_region ON users(location_region) WHERE location_region IS NOT NULL;
