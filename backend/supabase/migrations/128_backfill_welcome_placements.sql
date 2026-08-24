-- Backfill the signup welcome Discovery placements for creators who joined
-- before 126 added the columns. Without this, beta artists/producers see 0 free
-- plays even though onboarding promises 10.

-- 1) Creators with no credits row yet.
INSERT INTO public.credits (
  artist_id,
  balance,
  welcome_placements_remaining,
  welcome_bonus_granted_at
)
SELECT u.id, 0, 10, NOW()
FROM public.users u
WHERE u.role IN ('artist', 'service_provider')
  AND NOT EXISTS (
    SELECT 1 FROM public.credits c WHERE c.artist_id = u.id
  )
ON CONFLICT (artist_id) DO NOTHING;

-- 2) Creators who already had a credits row but never received the bonus.
UPDATE public.credits c
SET welcome_placements_remaining = 10,
    welcome_bonus_granted_at = NOW(),
    updated_at = NOW()
FROM public.users u
WHERE u.id = c.artist_id
  AND u.role IN ('artist', 'service_provider')
  AND c.welcome_bonus_granted_at IS NULL;
