-- One verified mobile number per account, and a text-message code for each sign-in.
-- Phone numbers stay off public profiles. The API uses the service role.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

COMMENT ON COLUMN public.users.phone_e164 IS
  'Verified E.164 mobile number. Unique across accounts. Never returned on public profiles.';

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_e164_unique
  ON public.users (phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.phone_mfa_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_mfa_challenges_user_created_idx
  ON public.phone_mfa_challenges (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS phone_mfa_challenges_phone_created_idx
  ON public.phone_mfa_challenges (phone_e164, created_at DESC);

CREATE TABLE IF NOT EXISTS public.phone_mfa_sessions (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  auth_time bigint NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, auth_time)
);

ALTER TABLE public.phone_mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_mfa_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.phone_mfa_challenges FROM anon, authenticated;
REVOKE ALL ON TABLE public.phone_mfa_sessions FROM anon, authenticated;
