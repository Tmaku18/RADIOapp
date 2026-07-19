-- Per-song "Ears Reached" = unique listeners for a song. Mirrors the platform
-- definition in get_radio_ears_reached() / archive_song_ears(): a distinct
-- authenticated listener (prospector_sessions.user_id) plus a distinct guest
-- device (radio_listener_presence.stream_token) that is not tied to any
-- authenticated session. Used by the public trending endpoint to show reach
-- per song instead of raw play counts.

CREATE OR REPLACE FUNCTION public.get_song_ears_reached(p_song_ids uuid[])
RETURNS TABLE(song_id uuid, ears bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT e.song_id, COUNT(*)::bigint AS ears
  FROM (
    SELECT DISTINCT ps.song_id, 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY(p_song_ids) AND ps.user_id IS NOT NULL
    UNION
    SELECT DISTINCT rlp.song_id, 't:' || rlp.stream_token
    FROM public.radio_listener_presence rlp
    WHERE rlp.song_id = ANY(p_song_ids)
      AND rlp.stream_token IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = rlp.stream_token
      )
  ) e
  GROUP BY e.song_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_song_ears_reached(uuid[]) TO anon, authenticated, service_role;
