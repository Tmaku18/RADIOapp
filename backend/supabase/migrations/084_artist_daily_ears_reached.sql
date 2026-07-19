-- Daily unique ears reached for an artist catalog (for analytics charts).

CREATE OR REPLACE FUNCTION public.get_artist_daily_ears_reached(
  p_song_ids UUID[],
  p_since TIMESTAMPTZ
)
RETURNS TABLE (
  day DATE,
  ears_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.day,
    COUNT(DISTINCT e.ear_key)::BIGINT AS ears_count
  FROM (
    SELECT
      (ps.started_at AT TIME ZONE 'UTC')::date AS day,
      'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY (p_song_ids)
      AND ps.user_id IS NOT NULL
      AND ps.started_at >= p_since

    UNION ALL

    SELECT
      (rlp.created_at AT TIME ZONE 'UTC')::date AS day,
      't:' || rlp.stream_token AS ear_key
    FROM public.radio_listener_presence rlp
    WHERE rlp.song_id = ANY (p_song_ids)
      AND rlp.stream_token IS NOT NULL
      AND rlp.created_at >= p_since
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = rlp.stream_token
      )
  ) e
  GROUP BY e.day
  ORDER BY e.day ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_artist_daily_ears_reached(UUID[], TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_artist_daily_ears_reached(UUID[], TIMESTAMPTZ) TO service_role;
