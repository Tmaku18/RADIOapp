-- Aggregated per-song stats helper used by the artist "My Songs" page so we can
-- compute real plays / listener-impressions / likes for many songs in one round
-- trip. Returning a SETOF avoids paginating the (potentially very large) plays
-- table from the API server.
--
-- Inputs:
--   p_song_ids - array of song UUIDs to summarize.
-- Returns one row per requested song id (zeroes when there is no activity).

CREATE OR REPLACE FUNCTION public.get_artist_song_stats(p_song_ids UUID[])
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
    GROUP BY p.song_id
  ),
  like_stats AS (
    SELECT
      l.song_id,
      COUNT(*)::BIGINT AS like_count
    FROM public.likes l
    WHERE l.song_id = ANY (p_song_ids)
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

GRANT EXECUTE ON FUNCTION public.get_artist_song_stats(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_artist_song_stats(UUID[]) TO service_role;
