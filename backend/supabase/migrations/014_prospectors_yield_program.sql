-- Migration: Prospector's Yield program
-- Adds Prospector rewards + proof-of-listening primitives:
-- - prospector_yield (balance + tier counters)
-- - prospector_sessions (heartbeat sessions)
-- - prospector_refinements (1-10 score)
-- - prospector_surveys (context responses)
-- - prospector_check_ins (anti-bot tap)
-- - prospector_redemptions (payout requests)

-- ---------------------------------------------------------------------------
-- 1) Yield balance + tier progress
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospector_yield (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  total_earned_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_earned_cents >= 0),
  total_redeemed_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_redeemed_cents >= 0),
  ores_refined_count INTEGER NOT NULL DEFAULT 0 CHECK (ores_refined_count >= 0),
  tier TEXT NOT NULL DEFAULT 'none' CHECK (tier IN ('none', 'copper', 'silver', 'gold', 'diamond')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospector_yield_tier ON prospector_yield(tier);

COMMENT ON TABLE prospector_yield IS 'Prospector rewards balance (in cents) + tier progress.';

-- ---------------------------------------------------------------------------
-- 2) Proof-of-listening sessions (heartbeat-based)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospector_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  play_id UUID REFERENCES plays(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  heartbeat_count INTEGER NOT NULL DEFAULT 0 CHECK (heartbeat_count >= 0),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospector_sessions_user_active ON prospector_sessions(user_id, ended_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prospector_sessions_song_time ON prospector_sessions(song_id, started_at DESC);

COMMENT ON TABLE prospector_sessions IS 'Heartbeat sessions for verified listening; used for Yield accrual and retention analytics.';

-- ---------------------------------------------------------------------------
-- 3) Refinement (1-10 rating) - one per user per song
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospector_refinements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  play_id UUID REFERENCES plays(id) ON DELETE SET NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_prospector_refinements_song ON prospector_refinements(song_id, created_at DESC);

COMMENT ON TABLE prospector_refinements IS 'Prospector 1-10 refinement score per ore (song).';

-- ---------------------------------------------------------------------------
-- 4) Survey (context) - one per user per song
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospector_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  play_id UUID REFERENCES plays(id) ON DELETE SET NULL,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_prospector_surveys_song ON prospector_surveys(song_id, created_at DESC);

COMMENT ON TABLE prospector_surveys IS 'Prospector survey responses per ore (song). Stored as JSONB for flexibility.';

-- ---------------------------------------------------------------------------
-- 5) Anti-bot check-ins (Ripple tap)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospector_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES prospector_sessions(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospector_check_ins_user_time ON prospector_check_ins(user_id, checked_at DESC);

COMMENT ON TABLE prospector_check_ins IS 'Anti-bot proof: periodic user check-in while listening (e.g. every 20 minutes).';

-- ---------------------------------------------------------------------------
-- 6) Redemptions (payout requests)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospector_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  type TEXT NOT NULL CHECK (type IN ('virtual_visa', 'merch', 'boost_credits')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'failed', 'cancelled')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospector_redemptions_user_time ON prospector_redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospector_redemptions_status ON prospector_redemptions(status, created_at DESC);

COMMENT ON TABLE prospector_redemptions IS 'Prospector redemption requests (manual or automated fulfillment).';

-- ---------------------------------------------------------------------------
-- RLS + Policies (Firebase uid in JWT "sub")
-- ---------------------------------------------------------------------------
ALTER TABLE prospector_yield ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospector_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospector_refinements ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospector_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospector_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospector_redemptions ENABLE ROW LEVEL SECURITY;

-- prospector_yield
CREATE POLICY "Prospectors can read their yield" ON prospector_yield
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Service role can manage prospector_yield" ON prospector_yield
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- prospector_sessions
CREATE POLICY "Prospectors can read their sessions" ON prospector_sessions
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Service role can manage prospector_sessions" ON prospector_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- prospector_refinements
CREATE POLICY "Prospectors can read their refinements" ON prospector_refinements
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Prospectors can create or update their refinements" ON prospector_refinements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Prospectors can update their refinements" ON prospector_refinements
  FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Service role can manage prospector_refinements" ON prospector_refinements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- prospector_surveys
CREATE POLICY "Prospectors can read their surveys" ON prospector_surveys
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Prospectors can create or update their surveys" ON prospector_surveys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Prospectors can update their surveys" ON prospector_surveys
  FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Service role can manage prospector_surveys" ON prospector_surveys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- prospector_check_ins
CREATE POLICY "Prospectors can read their check-ins" ON prospector_check_ins
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Prospectors can create their check-ins" ON prospector_check_ins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Service role can manage prospector_check_ins" ON prospector_check_ins
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- prospector_redemptions
CREATE POLICY "Prospectors can read their redemptions" ON prospector_redemptions
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Prospectors can create their redemptions" ON prospector_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Service role can manage prospector_redemptions" ON prospector_redemptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

