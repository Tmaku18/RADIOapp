-- Catalyst & Engine MVP: PostGIS, hero/social/mentor, venue_ads, song_catalyst_credits, referrals
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE service_providers
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
  ADD COLUMN IF NOT EXISTS mentor_opt_in BOOLEAN DEFAULT false;

ALTER TABLE service_providers
  ADD COLUMN IF NOT EXISTS location_geo geography(POINT);

UPDATE service_providers
SET location_geo = ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL AND location_geo IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_providers_location_geo
  ON service_providers USING GIST (location_geo);

ALTER TABLE provider_portfolio_items DROP CONSTRAINT IF EXISTS provider_portfolio_items_type_check;
ALTER TABLE provider_portfolio_items ADD CONSTRAINT provider_portfolio_items_type_check
  CHECK (type IN ('image', 'audio', 'video'));

CREATE TABLE IF NOT EXISTS venue_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT DEFAULT 'global',
  image_url TEXT NOT NULL,
  link_url TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_venue_ads_schedule ON venue_ads(station_id, start_at, end_at) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS song_catalyst_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'cover_art' CHECK (role IN ('cover_art', 'video', 'production', 'photo', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_song_catalyst_credits_song ON song_catalyst_credits(song_id);
CREATE INDEX IF NOT EXISTS idx_song_catalyst_credits_user ON song_catalyst_credits(user_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_user_id) WHERE referred_by_user_id IS NOT NULL;

-- RPC for PostGIS nearby search (returns user_id and distance_km for providers with location_geo)
CREATE OR REPLACE FUNCTION get_provider_ids_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision
)
RETURNS TABLE (user_id uuid, distance_km double precision)
LANGUAGE sql
STABLE
AS $$
  SELECT sp.user_id,
         (ST_Distance(sp.location_geo, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000.0)::double precision AS distance_km
  FROM service_providers sp
  WHERE sp.location_geo IS NOT NULL
    AND ST_DWithin(
      sp.location_geo,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000.0
    )
  ORDER BY sp.location_geo <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
$$;

-- Keep location_geo in sync with lat/lng on service_providers
CREATE OR REPLACE FUNCTION set_service_provider_location_geo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location_geo := ST_SetSRID(ST_MakePoint(NEW.lng::double precision, NEW.lat::double precision), 4326)::geography;
  ELSE
    NEW.location_geo := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_service_providers_location_geo ON service_providers;
CREATE TRIGGER trg_service_providers_location_geo
  BEFORE INSERT OR UPDATE OF lat, lng ON service_providers
  FOR EACH ROW EXECUTE FUNCTION set_service_provider_location_geo();
