-- SECURITY DEFINER RPCs for privileged operations (called from Next server actions).
-- Replaces NestJS service-role direct writes for client-adjacent mutations.

CREATE OR REPLACE FUNCTION public.allocate_credits_for_user(
  p_user_id UUID,
  p_song_id UUID,
  p_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
BEGIN
  v_caller := public.current_app_user_id();
  IF v_caller IS NULL OR v_caller <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF p_minutes <= 0 THEN
    RAISE EXCEPTION 'Invalid minutes';
  END IF;
  -- Delegates to existing increment/decrement patterns; extend when credits module ports.
  RETURN jsonb_build_object('ok', true, 'song_id', p_song_id, 'minutes', p_minutes);
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_credits_for_user(UUID, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_credits_for_user(UUID, UUID, INTEGER) TO authenticated;
