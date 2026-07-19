-- Extend get_artist_song_stats so it can compute either lifetime stats (default)
-- or a windowed view (e.g. last 30 days). Used by:
--   - artist "My Songs" page (lifetime, no window)
--   - artist analytics dashboard (lifetime + windowed daily series)
--   - public artist profile (lifetime + monthly listeners proxy)
--
-- Adding the optional p_since arg is backwards-compatible with the existing
-- signature: existing callers that pass a single uuid[] continue to work.

DROP FUNCTION IF EXISTS public.get_artist_song_stats(UUID[]);
DROP FUNCTION IF EXISTS public.get_artist_song_stats(UUID[], TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_artist_song_stats(
  p_song_ids UUID[],
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  song_id UUID,
  plays_count BIGINT,
  listener_count_sum BIGINT,
  like_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH targets AS (
    SELECT UNNEST(p_song_ids) AS song_id
  ),
  play_stats AS (
    SELECT
      p.song_id,
      COUNT(*)::BIGINT AS plays_count,
      COALESCE(SUM(p.listener_count), 0)::BIGINT AS listener_count_sum
    FROM public.plays p
    WHERE p.song_id = ANY (p_song_ids)
      AND (p_since IS NULL OR p.played_at >= p_since)
    GROUP BY p.song_id
  ),
  like_stats AS (
    SELECT
      l.song_id,
      COUNT(*)::BIGINT AS like_count
    FROM public.likes l
    WHERE l.song_id = ANY (p_song_ids)
      AND (p_since IS NULL OR l.created_at >= p_since)
    GROUP BY l.song_id
  )
  SELECT
    t.song_id,
    COALESCE(ps.plays_count, 0)::BIGINT AS plays_count,
    COALESCE(ps.listener_count_sum, 0)::BIGINT AS listener_count_sum,
    COALESCE(ls.like_count, 0)::BIGINT AS like_count
  FROM targets t
  LEFT JOIN play_stats ps ON ps.song_id = t.song_id
  LEFT JOIN like_stats ls ON ls.song_id = t.song_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_artist_song_stats(UUID[], TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_artist_song_stats(UUID[], TIMESTAMPTZ) TO service_role;
