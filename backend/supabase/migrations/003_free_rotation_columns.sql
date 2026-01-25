-- Migration: Add free rotation columns to songs table
-- This supports the Admin Free Rotation Search feature (Item 5)

-- Add admin_free_rotation flag (admin-controlled)
ALTER TABLE songs ADD COLUMN IF NOT EXISTS admin_free_rotation BOOLEAN DEFAULT FALSE;

-- Add paid_play_count to track songs that have had at least 1 paid play
-- Songs must have paid_play_count > 0 to be eligible for free rotation
ALTER TABLE songs ADD COLUMN IF NOT EXISTS paid_play_count INTEGER DEFAULT 0;

-- Create index for efficient free rotation queries
CREATE INDEX IF NOT EXISTS idx_songs_free_rotation 
ON songs(admin_free_rotation, opt_in_free_play, paid_play_count) 
WHERE status = 'approved';

-- Comment explaining eligibility rules
COMMENT ON COLUMN songs.admin_free_rotation IS 'Admin-controlled flag for free rotation eligibility. Song must also have opt_in_free_play=true AND paid_play_count>0 to be eligible.';
COMMENT ON COLUMN songs.paid_play_count IS 'Number of times this song has been played with credits. Must be >0 for free rotation eligibility.';
