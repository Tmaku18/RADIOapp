-- Preserve "Ears Reached" when a whole user account is deleted. Deleting the
-- users row cascades that listener's prospector_sessions, which would drop
-- their authenticated ear ('u:<user_id>'). Archive it first, but only if they
-- were ever actually present on radio (so non-listeners don't inflate the count).

CREATE OR REPLACE FUNCTION public.archive_user_ear(p_user_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.radio_ears_archive (ear_key)
  SELECT 'u:' || p_user_id::text
  WHERE EXISTS (
    SELECT 1 FROM public.prospector_sessions ps
    WHERE ps.user_id = p_user_id
  )
  ON CONFLICT (ear_key) DO NOTHING;
$$;

GRANT EXECUTE ON FUNCTION public.archive_user_ear(uuid) TO service_role;
