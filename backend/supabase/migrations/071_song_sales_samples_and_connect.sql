-- Song sales feature:
--  * 30-second previewable samples (start/end + rendered public sample_url)
--  * Per-song pricing (flat default, configurable later)
--  * song_purchases ledger (entitlement to full play + download)
--  * Artist Stripe Connect (Express) account fields for automated payouts

-- 1) Sample + pricing columns on songs
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS sample_start_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sample_end_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS sample_url TEXT,
  ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 99,
  ADD COLUMN IF NOT EXISTS is_for_sale BOOLEAN NOT NULL DEFAULT TRUE;

-- 2) Purchase ledger: one row per (buyer, song). Grants full play + download.
CREATE TABLE IF NOT EXISTS public.song_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  artist_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, song_id)
);
CREATE INDEX IF NOT EXISTS idx_song_purchases_user ON public.song_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_song_purchases_song ON public.song_purchases(song_id);
CREATE INDEX IF NOT EXISTS idx_song_purchases_artist ON public.song_purchases(artist_id);

-- 3) Artist Stripe Connect (Express) account state on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_stripe_connect_account
  ON public.users(stripe_connect_account_id);

NOTIFY pgrst, 'reload schema';
