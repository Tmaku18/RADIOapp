-- Pro Networks Services marketplace fields:
-- - currency, contact email/phone/link, is_published flag.
-- The existing rate_cents / rate_type columns drive price; we add `currency`
-- (so the same column works for non-USD later), the contact methods that the
-- subscription paywall hides, and a published toggle so users can draft.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE service_listings
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_link TEXT,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN service_listings.currency IS 'ISO-4217 currency code for rate_cents.';
COMMENT ON COLUMN service_listings.contact_email IS 'Contact email shown only to active Pro Networks subscribers.';
COMMENT ON COLUMN service_listings.contact_phone IS 'Contact phone shown only to active Pro Networks subscribers.';
COMMENT ON COLUMN service_listings.contact_link IS 'External booking URL shown only to active Pro Networks subscribers.';
COMMENT ON COLUMN service_listings.is_published IS 'When false, the listing is hidden from public marketplace views.';

CREATE INDEX IF NOT EXISTS idx_service_listings_published_created
  ON service_listings(is_published, created_at DESC)
  WHERE is_published = TRUE;

CREATE INDEX IF NOT EXISTS idx_service_listings_title_trgm
  ON service_listings USING GIN (lower(title) gin_trgm_ops);
