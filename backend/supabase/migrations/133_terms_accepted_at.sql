-- Record when a new account agreed to the Terms and Community Guidelines.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
