-- Add per-song play purchase fields to transactions.
-- When set, payment success adds plays to songs.credits_remaining instead of credits balance.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plays_purchased INTEGER;

CREATE INDEX IF NOT EXISTS idx_transactions_song_id ON transactions(song_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_checkout_session_id ON transactions(stripe_checkout_session_id);
