-- Migration: Refinery overhaul
-- Adds:
-- - songs.is_public, refinery_submitted_at, refinery_review_count, refinery_min_reviews, refinery_expedited
-- - reviewers table (track signups; auto-accepted)
-- - refinery_custom_questions table (artist's per-song questions, max 10)
-- - refinery_reviews table (single source of truth for full structured reviews)
-- - increment_refinery_review_count RPC + trigger to update songs.refinery_review_count + reviewers.total_reviews
-- - RLS policies for all new tables
-- - Indexes for query patterns (analytics, reviewer queue)

-- ---------------------------------------------------------------------------
-- 1) Songs columns
-- ---------------------------------------------------------------------------
-- Ensure base in_refinery column exists (created in 015_refinery.sql, but kept
-- here so this migration is self-applicable to environments that haven't run 015 yet).
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS in_refinery BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS refinery_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refinery_review_count INTEGER NOT NULL DEFAULT 0 CHECK (refinery_review_count >= 0),
  ADD COLUMN IF NOT EXISTS refinery_min_reviews INTEGER NOT NULL DEFAULT 100 CHECK (refinery_min_reviews > 0),
  ADD COLUMN IF NOT EXISTS refinery_expedited BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_songs_is_public ON songs(is_public)
  WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_songs_refinery_queue
  ON songs(in_refinery, refinery_review_count, refinery_submitted_at)
  WHERE in_refinery = TRUE;

-- Tag transactions with their purpose so the Stripe webhook can route refinery
-- submissions distinctly from credits / song_plays purchases. Existing rows
-- remain NULL (defaults handled by application logic).
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS purpose TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_purpose ON transactions(purpose)
  WHERE purpose IS NOT NULL;

COMMENT ON COLUMN transactions.purpose IS 'Optional purpose tag (e.g. ''refinery_submission'') used by webhook handlers to dispatch fulfillment.';

COMMENT ON COLUMN songs.is_public IS 'Public songs play on radio; private songs are hidden from rotation but can still go to The Refinery.';
COMMENT ON COLUMN songs.refinery_submitted_at IS 'Timestamp when artist submitted song to The Refinery (paid).';
COMMENT ON COLUMN songs.refinery_review_count IS 'Cached count of completed structured reviews; song is auto-removed from queue once it reaches refinery_min_reviews.';
COMMENT ON COLUMN songs.refinery_min_reviews IS 'Minimum number of reviews before the song leaves the queue (default 100).';

-- ---------------------------------------------------------------------------
-- 2) Reviewers table (auto-accepted; tracks signups for analytics)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviewers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_reviews INTEGER NOT NULL DEFAULT 0 CHECK (total_reviews >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_reviewers_active ON reviewers(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_reviewers_signed_up_at ON reviewers(signed_up_at DESC);

COMMENT ON TABLE reviewers IS 'Users who signed up as Refinery reviewers. Auto-accepted; signup is tracked to count active reviewer base.';

-- ---------------------------------------------------------------------------
-- 3) Refinery custom questions (artist supplies up to 10 per song)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refinery_custom_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  display_order SMALLINT NOT NULL CHECK (display_order BETWEEN 0 AND 9),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(song_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_refinery_custom_questions_song
  ON refinery_custom_questions(song_id, display_order);

COMMENT ON TABLE refinery_custom_questions IS 'Artist-supplied custom questions (max 10) attached to a song in The Refinery.';

-- ---------------------------------------------------------------------------
-- 4) Refinery reviews (the structured review payload; one per reviewer per song)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refinery_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 1-10 rating questions (standard, required)
  overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 10),
  beat_rating SMALLINT NOT NULL CHECK (beat_rating BETWEEN 1 AND 10),
  lyrics_rating SMALLINT NOT NULL CHECK (lyrics_rating BETWEEN 1 AND 10),
  lyrics_beat_match_rating SMALLINT NOT NULL CHECK (lyrics_beat_match_rating BETWEEN 1 AND 10),
  pacing_rating SMALLINT NOT NULL CHECK (pacing_rating BETWEEN 1 AND 10),
  chorus_rating SMALLINT NOT NULL CHECK (chorus_rating BETWEEN 1 AND 10),
  opening_ending_rating SMALLINT NOT NULL CHECK (opening_ending_rating BETWEEN 1 AND 10),
  -- Standard survey responses (yes/no/scale, JSONB keyed by question key)
  survey_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Artist's custom question responses (JSONB keyed by custom question id)
  custom_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Optional free-text comment
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(reviewer_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_refinery_reviews_song_created
  ON refinery_reviews(song_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refinery_reviews_reviewer
  ON refinery_reviews(reviewer_id, created_at DESC);

COMMENT ON TABLE refinery_reviews IS 'Structured review (ratings + standard survey + custom responses) submitted by a reviewer for a song in The Refinery.';

-- ---------------------------------------------------------------------------
-- 5) Triggers: keep songs.refinery_review_count + reviewers.total_reviews in sync
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refinery_reviews_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_min_reviews INTEGER;
  v_new_count INTEGER;
BEGIN
  UPDATE songs
  SET refinery_review_count = refinery_review_count + 1,
      updated_at = NOW()
  WHERE id = NEW.song_id
  RETURNING refinery_review_count, refinery_min_reviews INTO v_new_count, v_min_reviews;

  IF v_new_count IS NOT NULL AND v_min_reviews IS NOT NULL AND v_new_count >= v_min_reviews THEN
    UPDATE songs SET in_refinery = FALSE, updated_at = NOW() WHERE id = NEW.song_id AND in_refinery = TRUE;
  END IF;

  INSERT INTO reviewers (user_id, total_reviews, is_active)
  VALUES (NEW.reviewer_id, 1, TRUE)
  ON CONFLICT (user_id) DO UPDATE
    SET total_reviews = reviewers.total_reviews + 1,
        is_active = TRUE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refinery_reviews_after_insert ON refinery_reviews;
CREATE TRIGGER trg_refinery_reviews_after_insert
  AFTER INSERT ON refinery_reviews
  FOR EACH ROW EXECUTE FUNCTION refinery_reviews_after_insert();

-- ---------------------------------------------------------------------------
-- 6) RLS policies (Firebase uid in JWT "sub")
-- ---------------------------------------------------------------------------
ALTER TABLE reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE refinery_custom_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refinery_reviews ENABLE ROW LEVEL SECURITY;

-- reviewers
CREATE POLICY "Users can read their own reviewer row" ON reviewers
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'));

CREATE POLICY "Service role can manage reviewers" ON reviewers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- refinery_custom_questions: any authenticated user can read; only service role writes
CREATE POLICY "Authenticated can read refinery custom questions" ON refinery_custom_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage refinery_custom_questions" ON refinery_custom_questions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- refinery_reviews:
--   - reviewer can read their own reviews
--   - artist (song owner) can read all reviews for their songs
--   - service role manages writes (backend validates + inserts)
CREATE POLICY "Reviewer can read own refinery reviews" ON refinery_reviews
  FOR SELECT TO authenticated
  USING (reviewer_id IN (SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'));

CREATE POLICY "Artist can read reviews for their own songs" ON refinery_reviews
  FOR SELECT TO authenticated
  USING (
    song_id IN (
      SELECT id FROM songs WHERE artist_id IN (
        SELECT id FROM users WHERE firebase_uid = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Service role can manage refinery_reviews" ON refinery_reviews
  FOR ALL TO service_role USING (true) WITH CHECK (true);
