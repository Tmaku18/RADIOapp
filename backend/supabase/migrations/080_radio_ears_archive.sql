-- Preserve the "Ears Reached" count when songs (and their listener rows) are
-- deleted. Deleting a song cascades/removes its prospector_sessions and
-- radio_listener_presence rows, which would otherwise shrink the unique-ears
-- figure. We archive the distinct "ear identities" before they disappear.
--
-- Lowest-memory shape that still preserves UNIQUENESS: a single text key per
-- distinct lost listener (a plain counter would overcount listeners who heard
-- multiple songs). Keys are namespaced:
--   'u:<user_id>'      -> an authenticated listener
--   't:<stream_token>' -> a guest device not tied to any authenticated session

CREATE TABLE IF NOT EXISTS public.radio_ears_archive (
  ear_key text PRIMARY KEY
);

-- Archive every distinct ear that listened to a single song. Call this BEFORE
-- deleting the song's prospector_sessions / radio_listener_presence rows.
CREATE OR REPLACE FUNCTION public.archive_song_ears(p_song_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.radio_ears_archive (ear_key)
  SELECT DISTINCT 'u:' || ps.user_id::text
  FROM public.prospector_sessions ps
  WHERE ps.song_id = p_song_id AND ps.user_id IS NOT NULL
  ON CONFLICT (ear_key) DO NOTHING;

  INSERT INTO public.radio_ears_archive (ear_key)
  SELECT DISTINCT 't:' || rlp.stream_token
  FROM public.radio_listener_presence rlp
  WHERE rlp.song_id = p_song_id
    AND rlp.stream_token IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.prospector_sessions ps2
      WHERE ps2.stream_token = rlp.stream_token
    )
  ON CONFLICT (ear_key) DO NOTHING;
$$;

-- Bulk variant: archive ears across every song belonging to an artist. Call
-- this BEFORE bulk-deleting an artist's songs (account deletion / ban).
CREATE OR REPLACE FUNCTION public.archive_artist_ears(p_artist_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.radio_ears_archive (ear_key)
  SELECT DISTINCT 'u:' || ps.user_id::text
  FROM public.prospector_sessions ps
  JOIN public.songs s ON s.id = ps.song_id
  WHERE s.artist_id = p_artist_id AND ps.user_id IS NOT NULL
  ON CONFLICT (ear_key) DO NOTHING;

  INSERT INTO public.radio_ears_archive (ear_key)
  SELECT DISTINCT 't:' || rlp.stream_token
  FROM public.radio_listener_presence rlp
  JOIN public.songs s ON s.id = rlp.song_id
  WHERE s.artist_id = p_artist_id
    AND rlp.stream_token IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.prospector_sessions ps2
      WHERE ps2.stream_token = rlp.stream_token
    )
  ON CONFLICT (ear_key) DO NOTHING;
$$;

-- Cumulative unique listeners = live ears UNION archived ears (de-duplicated).
CREATE OR REPLACE FUNCTION public.get_radio_ears_reached()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    WHERE ps.user_id IS NOT NULL
    UNION
    SELECT DISTINCT 't:' || rlp.stream_token
    FROM public.radio_listener_presence rlp
    WHERE rlp.stream_token IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = rlp.stream_token
      )
    UNION
    SELECT ear_key FROM public.radio_ears_archive
  ) all_ears;
$$;

GRANT EXECUTE ON FUNCTION public.archive_song_ears(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_artist_ears(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_radio_ears_reached() TO anon, authenticated, service_role;
