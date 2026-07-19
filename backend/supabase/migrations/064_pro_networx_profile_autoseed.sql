-- Auto-create a pro_networx.profiles row whenever a users row is inserted, so
-- every account is immediately a Pro Networks account. The seed copies the
-- LinkedIn-style fields the user already provided to their radio profile
-- (display name, bio, headline, social URLs) so they don't have to fill it in
-- twice. The trigger is idempotent and uses ON CONFLICT DO NOTHING.

CREATE OR REPLACE FUNCTION pro_networx.seed_profile_from_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pro_networx
AS $$
DECLARE
  u RECORD;
BEGIN
  SELECT
    id, display_name, headline, bio, location_region, website_url
  INTO u
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO pro_networx.profiles (
    user_id,
    available_for_work,
    skills_headline,
    current_title,
    about,
    website_url,
    created_at,
    updated_at
  )
  VALUES (
    u.id,
    TRUE,
    u.headline,
    u.headline,
    u.bio,
    u.website_url,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION pro_networx.seed_profile_from_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION pro_networx.seed_profile_from_user(UUID) TO service_role;

CREATE OR REPLACE FUNCTION pro_networx.handle_user_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pro_networx
AS $$
BEGIN
  PERFORM pro_networx.seed_profile_from_user(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_after_insert_seed_pro_profile ON public.users;
CREATE TRIGGER users_after_insert_seed_pro_profile
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION pro_networx.handle_user_inserted();

-- Backfill existing users that don't yet have a pro_networx.profiles row.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.id
    FROM public.users u
    LEFT JOIN pro_networx.profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL
  LOOP
    PERFORM pro_networx.seed_profile_from_user(r.id);
  END LOOP;
END;
$$;
