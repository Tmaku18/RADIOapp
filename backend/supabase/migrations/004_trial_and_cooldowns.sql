-- Trial rotation columns
ALTER TABLE songs ADD COLUMN IF NOT EXISTS trial_plays_remaining INTEGER DEFAULT 3;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS trial_plays_used INTEGER DEFAULT 0;

-- Set trial plays when a song is approved
CREATE OR REPLACE FUNCTION set_trial_plays_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    NEW.trial_plays_remaining := 3;
    NEW.trial_plays_used := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_trial_plays ON songs;
CREATE TRIGGER trigger_set_trial_plays
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION set_trial_plays_on_approval();

-- Artist notification cooldowns for "Up Next"
CREATE TABLE IF NOT EXISTS artist_notification_cooldowns (
  artist_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_push_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_count_today INTEGER DEFAULT 1
);
