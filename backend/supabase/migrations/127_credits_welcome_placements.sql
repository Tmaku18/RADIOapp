-- Welcome Discovery placements for new artists / producers.
-- Granted at signup (10) but only usable after beta ends (BETA_ALL_FREE=false).

ALTER TABLE public.credits
  ADD COLUMN IF NOT EXISTS welcome_placements_remaining INTEGER NOT NULL DEFAULT 0
    CHECK (welcome_placements_remaining >= 0);

ALTER TABLE public.credits
  ADD COLUMN IF NOT EXISTS welcome_bonus_granted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.credits.welcome_placements_remaining IS
  'Unused signup Discovery placements (each = one $1.99 placement / ~1000 exposures). Locked while beta is free.';

COMMENT ON COLUMN public.credits.welcome_bonus_granted_at IS
  'When the signup welcome placement bonus was granted; null means never granted.';
