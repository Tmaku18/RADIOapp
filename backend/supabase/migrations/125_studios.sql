-- Recording studios as first-class map listings, separate from people pins.
-- A studio is a business place: publication is studios.is_published (not
-- users.discoverable). The owner chooses whether the public pin is an exact
-- street address or the same fuzzed ZIP area used for people.

CREATE TABLE IF NOT EXISTS studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tagline TEXT,
  about TEXT,
  hero_image_url TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location_precision TEXT NOT NULL DEFAULT 'approximate'
    CHECK (location_precision IN ('exact', 'approximate')),
  contact_email TEXT,
  contact_phone TEXT,
  booking_link TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS studios_owner_idx ON studios (owner_user_id);
CREATE INDEX IF NOT EXISTS studios_published_geo_idx
  ON studios (is_published, lat, lng);

CREATE TABLE IF NOT EXISTS studio_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  unit TEXT NOT NULL CHECK (unit IN ('hour', 'day', 'half_day', 'session')),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS studio_rates_studio_idx
  ON studio_rates (studio_id, sort_order);

COMMENT ON TABLE studios IS
  'Producer-owned recording studios shown on Nearby. Exact pins are opt-in.';
COMMENT ON COLUMN studios.location_precision IS
  'exact = publish street geocode; approximate = ZIP centroid + 3km fuzz.';
COMMENT ON TABLE studio_rates IS
  'Public rate card for a studio. Lowest price_cents is the starting-at figure.';

ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_rates ENABLE ROW LEVEL SECURITY;
