-- Migration: Create play_decision_log table for algorithm transparency
-- Run this in Supabase SQL Editor or via CLI

-- Create the play_decision_log table
CREATE TABLE IF NOT EXISTS play_decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  selection_reason TEXT NOT NULL,  -- 'credits', 'trial', 'opt_in', 'admin_fallback', 'fallback'
  tier_at_selection TEXT,
  listener_count INTEGER,
  weight_score DECIMAL(10, 4),
  random_seed TEXT,
  competing_songs INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by song
CREATE INDEX IF NOT EXISTS idx_play_decision_log_song_id ON play_decision_log(song_id);

-- Index for querying by time
CREATE INDEX IF NOT EXISTS idx_play_decision_log_selected_at ON play_decision_log(selected_at DESC);

-- Index for analytics: reason breakdown
CREATE INDEX IF NOT EXISTS idx_play_decision_log_reason ON play_decision_log(selection_reason, selected_at DESC);

-- Comment for documentation
COMMENT ON TABLE play_decision_log IS 'Audit log for radio song selection decisions - proves algorithm fairness';
COMMENT ON COLUMN play_decision_log.selection_reason IS 'Why this song was selected: credits, trial, opt_in, admin_fallback, fallback';
COMMENT ON COLUMN play_decision_log.competing_songs IS 'How many eligible songs were in the pool when this was selected';
COMMENT ON COLUMN play_decision_log.weight_score IS 'The calculated weight score used in selection (if weighted random)';

-- Enable RLS (Row Level Security)
ALTER TABLE play_decision_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
CREATE POLICY "Admins can read play decision logs" ON play_decision_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.firebase_uid = auth.jwt() ->> 'sub' 
      AND users.role = 'admin'
    )
  );

-- Artists can see logs for their own songs
CREATE POLICY "Artists can read their song decision logs" ON play_decision_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM songs 
      WHERE songs.id = play_decision_log.song_id 
      AND songs.artist_id IN (
        SELECT id FROM users 
        WHERE firebase_uid = auth.jwt() ->> 'sub'
      )
    )
  );

-- Only service role can insert
CREATE POLICY "Service role can insert play decision logs" ON play_decision_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);
