-- Pivot: link public.users to Supabase Auth (dual-read during Firebase migration).
-- auth_user_id mirrors auth.users.id when the account is migrated/imported.
-- firebase_uid remains until cutover completes.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.users.auth_user_id IS
  'Supabase Auth user id (auth.users.id). Populated during firebase-to-supabase migration.';

-- Helper: resolve app user id from JWT (Supabase uid first, then firebase_uid legacy).
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users
  WHERE auth_user_id = auth.uid()
     OR firebase_uid = (select auth.uid())::text
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
