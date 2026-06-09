-- Listener genre preferences for onboarding and personalized artist suggestions.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS favorite_genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS genre_onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.users.favorite_genres IS
  'Genre ids (e.g. hip-hop, rap, country) chosen during onboarding.';
COMMENT ON COLUMN public.users.genre_onboarding_completed_at IS
  'When the user finished or skipped genre onboarding; NULL means show the prompt.';
