-- Migration: user discoverable/incognito toggle
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS discoverable BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_users_discoverable ON users(discoverable);

