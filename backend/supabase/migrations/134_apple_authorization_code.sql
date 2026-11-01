-- Last Sign in with Apple authorization code, used to revoke the token on account deletion.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS apple_authorization_code text;
