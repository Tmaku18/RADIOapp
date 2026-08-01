-- Song/beat prices must land on a fixed tier ladder so every price has a
-- matching App Store / Google Play consumable SKU. Stores can only sell
-- pre-registered products at fixed prices, so an arbitrary $7.50 song would
-- have no SKU to sell it with on mobile.
--
-- Ladder (cents): 99, 199, 299, 499, 999, 1999, 2999, 4999
-- Keep in sync with backend/src/payments/song-price-tiers.ts and
-- mobile/lib/core/constants/song_price_tiers.dart.

-- Snap every existing price to the nearest tier. Ties resolve downward so a
-- price sitting exactly between two tiers never silently costs buyers more.
UPDATE public.songs
SET price_cents = (
  SELECT tier
  FROM unnest(ARRAY[99, 199, 299, 499, 999, 1999, 2999, 4999]) AS tier
  ORDER BY abs(tier - public.songs.price_cents), tier
  LIMIT 1
)
WHERE price_cents IS NULL
   OR price_cents NOT IN (99, 199, 299, 499, 999, 1999, 2999, 4999);

-- Reject off-ladder prices going forward. The API also snaps on write; this is
-- the backstop for direct SQL and admin tooling.
ALTER TABLE public.songs
  DROP CONSTRAINT IF EXISTS songs_price_cents_tier_check;

ALTER TABLE public.songs
  ADD CONSTRAINT songs_price_cents_tier_check
  CHECK (price_cents IN (99, 199, 299, 499, 999, 1999, 2999, 4999));

COMMENT ON COLUMN public.songs.price_cents IS
  'Sale price in cents. Constrained to the store-sellable tier ladder (99, 199, 299, 499, 999, 1999, 2999, 4999) so each price maps to an App Store / Google Play SKU.';
