-- Song/beat purchases can now be paid for with an App Store or Google Play
-- consumable, not just Stripe. Store purchases carry no Connect destination
-- charge, so the platform always owes the artist a manual payout
-- (payout_status = 'pending', already surfaced by the admin payout queue).

ALTER TABLE public.song_purchases
  ADD COLUMN IF NOT EXISTS store TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS store_transaction_id TEXT;

ALTER TABLE public.song_purchases
  DROP CONSTRAINT IF EXISTS song_purchases_store_check;

ALTER TABLE public.song_purchases
  ADD CONSTRAINT song_purchases_store_check
  CHECK (store IN ('stripe', 'app_store', 'google_play'));

-- Idempotency: a replayed store receipt must never grant a second purchase.
CREATE UNIQUE INDEX IF NOT EXISTS idx_song_purchases_store_transaction
  ON public.song_purchases (store_transaction_id)
  WHERE store_transaction_id IS NOT NULL;

COMMENT ON COLUMN public.song_purchases.store IS
  'Which rail collected the money: stripe (web) or app_store / google_play (mobile in-app purchase).';
COMMENT ON COLUMN public.song_purchases.store_transaction_id IS
  'Apple transaction id or Google order id. Unique so a replayed receipt cannot grant twice.';
