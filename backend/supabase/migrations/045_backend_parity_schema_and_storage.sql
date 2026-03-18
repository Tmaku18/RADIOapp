-- Backend parity hardening:
-- - Ensure payments/core tables exist (transactions, credits) and expected columns/RPC are present
-- - Ensure creator network subscriptions table exists
-- - Ensure storage buckets used by backend exist with expected limits and MIME types

-- 1) Core payments tables
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT,
  stripe_charge_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  credits_purchased INTEGER NOT NULL DEFAULT 0 CHECK (credits_purchased >= 0),
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  plays_purchased INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  payment_method TEXT DEFAULT 'payment_intent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'payment_intent';

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_song_id ON transactions(song_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_payment_intent_id ON transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_checkout_session_id ON transactions(stripe_checkout_session_id);

CREATE TABLE IF NOT EXISTS credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_purchased INTEGER NOT NULL DEFAULT 0 CHECK (total_purchased >= 0),
  total_used INTEGER NOT NULL DEFAULT 0 CHECK (total_used >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credits_artist_id ON credits(artist_id);
CREATE INDEX IF NOT EXISTS idx_credits_balance ON credits(balance) WHERE balance > 0;

-- 2) RPC expected by payments service
CREATE OR REPLACE FUNCTION increment_credits(
  p_artist_id UUID,
  p_amount INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE credits
  SET balance = balance + p_amount,
      total_purchased = total_purchased + p_amount,
      updated_at = NOW()
  WHERE artist_id = p_artist_id;

  IF NOT FOUND THEN
    INSERT INTO credits (artist_id, balance, total_purchased)
    VALUES (p_artist_id, p_amount, p_amount);
  END IF;
END;
$$;

-- 3) Creator Network subscription tracking table
CREATE TABLE IF NOT EXISTS creator_network_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_network_subscriptions_status
  ON creator_network_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_creator_network_subscriptions_stripe_id
  ON creator_network_subscriptions(stripe_subscription_id);

-- 4) Storage buckets and limits used by backend/web
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed',
  'feed',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio',
  'portfolio',
  true,
  26214400,
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    'audio/webm',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Allow uploads to portfolio bucket" ON storage.objects;
CREATE POLICY "Allow uploads to portfolio bucket"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'portfolio');

DROP POLICY IF EXISTS "Public read for portfolio bucket" ON storage.objects;
CREATE POLICY "Public read for portfolio bucket"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'portfolio');
