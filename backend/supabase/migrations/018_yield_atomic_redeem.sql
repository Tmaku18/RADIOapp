-- Migration: Yield atomic redeem (idempotent)
-- Adds request_id idempotency + an atomic redeem RPC to prevent double-spend.

ALTER TABLE prospector_redemptions
  ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prospector_redemptions_user_request
  ON prospector_redemptions(user_id, request_id)
  WHERE request_id IS NOT NULL;

-- Atomic redeem RPC
-- - Locks prospector_yield row to prevent concurrent spend
-- - Enforces 1 pending redemption at a time (per user)
-- - Idempotent on request_id (returns existing redemption/balance)
CREATE OR REPLACE FUNCTION redeem_prospector_yield(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_type TEXT,
  p_request_id UUID
)
RETURNS TABLE (redemption_id UUID, new_balance_cents INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INTEGER;
  v_total_redeemed INTEGER;
  v_existing_id UUID;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount_cents must be positive';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id is required';
  END IF;

  -- Idempotency: if we've already processed this request_id, return it.
  SELECT id
    INTO v_existing_id
  FROM prospector_redemptions
  WHERE user_id = p_user_id AND request_id = p_request_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    SELECT balance_cents INTO v_balance
    FROM prospector_yield
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT v_existing_id, COALESCE(v_balance, 0);
    RETURN;
  END IF;

  -- Prevent multiple pending redemptions for the same user.
  IF EXISTS (
    SELECT 1
    FROM prospector_redemptions
    WHERE user_id = p_user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'already pending';
  END IF;

  -- Lock yield row and validate balance
  SELECT balance_cents, total_redeemed_cents
    INTO v_balance, v_total_redeemed
  FROM prospector_yield
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'yield row missing';
  END IF;

  IF v_balance < p_amount_cents THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  -- Insert redemption request
  INSERT INTO prospector_redemptions (
    user_id,
    amount_cents,
    type,
    status,
    request_id,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_amount_cents,
    p_type,
    'pending',
    p_request_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_existing_id;

  -- Deduct balance
  UPDATE prospector_yield
  SET
    balance_cents = v_balance - p_amount_cents,
    total_redeemed_cents = COALESCE(v_total_redeemed, 0) + p_amount_cents,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_existing_id, (v_balance - p_amount_cents);
END;
$$;

