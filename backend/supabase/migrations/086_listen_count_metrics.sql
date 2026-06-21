-- Listens vs Ears Reached:
--   Listens  = unique (song, listener) pairs — same account on 3 songs = 3 listens.
--   Ears     = unique listeners (accounts/devices) — same account counts once.

CREATE OR REPLACE FUNCTION public.get_radio_listen_count()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT ps.song_id, 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    WHERE ps.user_id IS NOT NULL
    UNION
    SELECT DISTINCT rlp.song_id, 't:' || rlp.stream_token AS ear_key
    FROM public.radio_listener_presence rlp
    WHERE rlp.stream_token IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = rlp.stream_token
      )
  ) song_listeners;
$$;

CREATE OR REPLACE FUNCTION public.get_artist_listen_count(p_artist_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT ps.song_id, 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    JOIN public.songs s ON s.id = ps.song_id
    WHERE s.artist_id = p_artist_id AND ps.user_id IS NOT NULL
    UNION
    SELECT DISTINCT rlp.song_id, 't:' || rlp.stream_token AS ear_key
    FROM public.radio_listener_presence rlp
    JOIN public.songs s ON s.id = rlp.song_id
    WHERE s.artist_id = p_artist_id
      AND rlp.stream_token IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = rlp.stream_token
      )
  ) artist_song_listeners;
$$;

CREATE OR REPLACE FUNCTION public.get_artist_listen_count_since(
  p_artist_id uuid,
  p_since timestamptz
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT ps.song_id, 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    JOIN public.songs s ON s.id = ps.song_id
    WHERE s.artist_id = p_artist_id
      AND ps.user_id IS NOT NULL
      AND ps.started_at >= p_since
    UNION
    SELECT DISTINCT rlp.song_id, 't:' || rlp.stream_token AS ear_key
    FROM public.radio_listener_presence rlp
    JOIN public.songs s ON s.id = rlp.song_id
    WHERE s.artist_id = p_artist_id
      AND rlp.stream_token IS NOT NULL
      AND rlp.created_at >= p_since
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = rlp.stream_token
      )
  ) artist_song_listeners;
$$;

CREATE OR REPLACE FUNCTION public.get_artist_daily_listens(
  p_song_ids uuid[],
  p_since timestamptz
)
RETURNS TABLE(day date, listens_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT d.day::date, COUNT(*)::bigint AS listens_count
  FROM (
    SELECT DISTINCT
      ps.song_id,
      date_trunc('day', ps.started_at AT TIME ZONE 'UTC')::date AS day,
      'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY(p_song_ids)
      AND ps.user_id IS NOT NULL
      AND ps.started_at >= p_since
    UNION
    SELECT DISTINCT
      rlp.song_id,
      date_trunc('day', rlp.created_at AT TIME ZONE 'UTC')::date AS day,
      't:' || rlp.stream_token AS ear_key
    FROM public.radio_listener_presence rlp
    WHERE rlp.song_id = ANY(p_song_ids)
      AND rlp.stream_token IS NOT NULL
      AND rlp.created_at >= p_since
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = rlp.stream_token
      )
  ) d
  GROUP BY d.day
  ORDER BY d.day;
$$;

GRANT EXECUTE ON FUNCTION public.get_radio_listen_count() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_artist_listen_count(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_artist_listen_count_since(uuid, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_artist_daily_listens(uuid[], timestamptz) TO authenticated, service_role;
