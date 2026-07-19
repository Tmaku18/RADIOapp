-- Aggregated daily stats for an artist's catalog so the analytics dashboard
-- can render real daily play / listen series without paginating through the
-- (potentially huge) plays table from the API server.

CREATE OR REPLACE FUNCTION public.get_artist_daily_stats(
  p_song_ids UUID[],
  p_since TIMESTAMPTZ
)
RETURNS TABLE (
  day DATE,
  plays_count BIGINT,
  listener_count_sum BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (p.played_at AT TIME ZONE 'UTC')::date AS day,
    COUNT(*)::BIGINT AS plays_count,
    COALESCE(SUM(p.listener_count), 0)::BIGINT AS listener_count_sum
  FROM public.plays p
  WHERE p.song_id = ANY (p_song_ids)
    AND p.played_at >= p_since
  GROUP BY (p.played_at AT TIME ZONE 'UTC')::date
  ORDER BY day ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_artist_daily_stats(UUID[], TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_artist_daily_stats(UUID[], TIMESTAMPTZ) TO service_role;
