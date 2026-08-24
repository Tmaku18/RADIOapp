-- Replay guards for store IAPs and livestream tips. The transactions table
-- declared stripe_charge_id UNIQUE inside CREATE TABLE IF NOT EXISTS on a
-- table that already existed, so the constraint never landed. stream_donations
-- only had a read-then-insert check.

CREATE UNIQUE INDEX IF NOT EXISTS transactions_stripe_charge_id_key
  ON public.transactions (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stream_donations_stripe_payment_intent_id_key
  ON public.stream_donations (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
