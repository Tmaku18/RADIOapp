-- Pro Networks paid tier:
-- - $9.99/mo recurring subscription that unlocks DMs and contact info on Services.
-- - Stripe coupon (duration=once, amount_off=500) applied on first invoice.
-- This is parallel to the existing creator_network_subscriptions table; we keep
-- that one intact for backward compatibility but the Pro Networks code path
-- uses pro_network_subscriptions only.

CREATE TABLE IF NOT EXISTS pro_network_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (
    status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')
  ),
  current_period_end TIMESTAMPTZ,
  intro_coupon_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_network_subscriptions_status
  ON pro_network_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_pro_network_subscriptions_user
  ON pro_network_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_pro_network_subscriptions_stripe_id
  ON pro_network_subscriptions(stripe_subscription_id);

CREATE OR REPLACE FUNCTION public.has_active_pro_network_sub(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pro_network_subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > NOW())
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_pro_network_sub(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_pro_network_sub(UUID) TO service_role;
