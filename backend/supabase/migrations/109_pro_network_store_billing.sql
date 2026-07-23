-- Store billing for Pro-Networx (App Store + Google Play) alongside Stripe.

ALTER TABLE public.pro_network_subscriptions
  ADD COLUMN IF NOT EXISTS store TEXT NOT NULL DEFAULT 'stripe'
    CHECK (store IN ('stripe', 'app_store', 'play')),
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS google_purchase_token TEXT,
  ADD COLUMN IF NOT EXISTS google_order_id TEXT,
  ADD COLUMN IF NOT EXISTS store_product_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_network_subs_apple_original_tx
  ON public.pro_network_subscriptions (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_network_subs_google_order
  ON public.pro_network_subscriptions (google_order_id)
  WHERE google_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_network_subs_google_token
  ON public.pro_network_subscriptions (google_purchase_token)
  WHERE google_purchase_token IS NOT NULL;
