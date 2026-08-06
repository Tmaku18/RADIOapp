-- Pro-Radio paid tier:
-- - $9.99/mo recurring subscription that unlocks on-demand full listening of
--   opted-in artist songs, personal playlists, and a controllable player queue.
-- - Stripe coupon (duration=once, amount_off=500) applied on first invoice.
-- Parallel to pro_network_subscriptions; separate product, separate table.

CREATE TABLE IF NOT EXISTS pro_radio_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (
    status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')
  ),
  current_period_end TIMESTAMPTZ,
  intro_coupon_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
  store TEXT NOT NULL DEFAULT 'stripe'
    CHECK (store IN ('stripe', 'app_store', 'play')),
  apple_original_transaction_id TEXT,
  google_purchase_token TEXT,
  google_order_id TEXT,
  store_product_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_radio_subscriptions_status
  ON pro_radio_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_pro_radio_subscriptions_user
  ON pro_radio_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_pro_radio_subscriptions_stripe_id
  ON pro_radio_subscriptions(stripe_subscription_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_radio_subs_apple_original_tx
  ON public.pro_radio_subscriptions (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_radio_subs_google_order
  ON public.pro_radio_subscriptions (google_order_id)
  WHERE google_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_radio_subs_google_token
  ON public.pro_radio_subscriptions (google_purchase_token)
  WHERE google_purchase_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.has_active_pro_radio_sub(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pro_radio_subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > NOW())
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_pro_radio_sub(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_pro_radio_sub(UUID) TO service_role;
