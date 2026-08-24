-- DJs and musicians satisfy the artist role guard and can hit the welcome
-- placement endpoint, but the original grant/backfill only covered artist and
-- service_provider.

INSERT INTO public.credits (
  artist_id,
  balance,
  welcome_placements_remaining,
  welcome_bonus_granted_at
)
SELECT u.id, 0, 10, NOW()
FROM public.users u
WHERE u.role IN ('dj', 'musician')
  AND NOT EXISTS (
    SELECT 1 FROM public.credits c WHERE c.artist_id = u.id
  )
ON CONFLICT (artist_id) DO NOTHING;

UPDATE public.credits c
SET
  welcome_placements_remaining = 10,
  welcome_bonus_granted_at = NOW(),
  updated_at = NOW()
FROM public.users u
WHERE u.id = c.artist_id
  AND u.role IN ('dj', 'musician')
  AND c.welcome_bonus_granted_at IS NULL;
