-- Artist-level unique "Ears Reached": distinct listeners who heard any song by
-- this artist (deduplicated across the catalog). Mirrors get_song_ears_reached
-- and get_radio_ears_reached ear-key semantics.

CREATE OR REPLACE FUNCTION public.get_artist_ears_reached(p_artist_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    JOIN public.songs s ON s.id = ps.song_id
    WHERE s.artist_id = p_artist_id AND ps.user_id IS NOT NULL
    UNION
    SELECT DISTINCT 't:' || rlp.stream_token AS ear_key
    FROM public.radio_listener_presence rlp
    JOIN public.songs s ON s.id = rlp.song_id
    WHERE s.artist_id = p_artist_id
      AND rlp.stream_token IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = rlp.stream_token
      )
  ) artist_ears;
$$;

GRANT EXECUTE ON FUNCTION public.get_artist_ears_reached(uuid) TO anon, authenticated, service_role;
