-- Add two-state reactions for radio play votes:
-- fire = positive vote, shit = negative vote.
-- Existing likes are treated as fire.

ALTER TABLE public.leaderboard_likes
  ADD COLUMN IF NOT EXISTS reaction text;

UPDATE public.leaderboard_likes
SET reaction = 'fire'
WHERE reaction IS NULL;

ALTER TABLE public.leaderboard_likes
  ALTER COLUMN reaction SET DEFAULT 'fire';

ALTER TABLE public.leaderboard_likes
  ALTER COLUMN reaction SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leaderboard_likes_reaction_check'
  ) THEN
    ALTER TABLE public.leaderboard_likes
      ADD CONSTRAINT leaderboard_likes_reaction_check
      CHECK (reaction IN ('fire', 'shit'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leaderboard_likes_play_reaction
  ON public.leaderboard_likes(play_id, reaction);

