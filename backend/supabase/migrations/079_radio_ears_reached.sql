-- "Ears Reached": cumulative count of unique listeners ever present on radio.
-- Combines authenticated listeners (prospector_sessions.user_id) with anonymous
-- guest devices (radio_listener_presence.stream_token), de-duplicating guest
-- tokens that belong to a known authenticated session so nobody is counted twice.
--
-- Note: this is a "best effort over time" figure. Presence rows are pruned when
-- a song is deleted, so ears for removed songs are not retained.

CREATE OR REPLACE FUNCTION public.get_radio_ears_reached()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT
    (
      SELECT COUNT(DISTINCT ps.user_id)
      FROM public.prospector_sessions ps
      WHERE ps.user_id IS NOT NULL
    )
    +
    (
      SELECT COUNT(DISTINCT rlp.stream_token)
      FROM public.radio_listener_presence rlp
      WHERE rlp.stream_token IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.prospector_sessions ps2
          WHERE ps2.stream_token = rlp.stream_token
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_radio_ears_reached() TO anon, authenticated, service_role;
