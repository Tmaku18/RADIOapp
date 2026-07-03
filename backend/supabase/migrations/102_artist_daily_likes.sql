-- Daily like (ripple) counts per UTC day for artist analytics charts.

CREATE OR REPLACE FUNCTION public.get_artist_daily_likes(
  p_song_ids uuid[],
  p_since timestamptz
)
RETURNS TABLE(day date, likes_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date_trunc('day', l.created_at AT TIME ZONE 'UTC')::date AS day,
    COUNT(*)::bigint AS likes_count
  FROM public.likes l
  WHERE l.song_id = ANY(p_song_ids)
    AND l.created_at >= p_since
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_artist_daily_likes(uuid[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_artist_daily_likes(uuid[], timestamptz) TO service_role;
