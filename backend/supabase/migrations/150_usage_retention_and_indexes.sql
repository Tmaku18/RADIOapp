-- Speed up the decision-log prune, drop stale listener-presence rows, and
-- keep automated notification cleanup covering the newer radio notice types.
-- Guest listen history lives in song_listen_events, so ears and listen counts
-- read that table instead of radio_listener_presence.

CREATE INDEX IF NOT EXISTS idx_play_decision_log_created_at
  ON public.play_decision_log (created_at);

DROP INDEX IF EXISTS public.idx_notifications_automated_created;
CREATE INDEX IF NOT EXISTS idx_notifications_automated_created
  ON public.notifications (created_at)
  WHERE type IN (
    'song_played',
    'artist_song_on_radio',
    'song_up_next',
    'song_up_next_5min',
    'artist_song_first_play',
    'artist_live_nudge'
  );

CREATE OR REPLACE FUNCTION public.prune_automated_notifications(
  p_older_than interval,
  p_batch integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  deleted integer;
  batch_size integer;
BEGIN
  batch_size := least(greatest(coalesce(p_batch, 50000), 1), 100000);
  WITH doomed AS (
    SELECT id
    FROM public.notifications
    WHERE type IN (
      'song_played',
      'artist_song_on_radio',
      'song_up_next',
      'song_up_next_5min',
      'artist_song_first_play',
      'artist_live_nudge'
    )
      AND created_at < now() - p_older_than
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.notifications n
  USING doomed
  WHERE n.id = doomed.id;

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_automated_notifications(interval, integer)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_automated_notifications(interval, integer)
  TO service_role;

-- Copy any guest presence row that never made it into song_listen_events
-- before presence is allowed to shrink.
INSERT INTO public.song_listen_events (song_id, stream_token, started_at)
SELECT rlp.song_id, rlp.stream_token, rlp.created_at
FROM public.radio_listener_presence rlp
WHERE rlp.stream_token IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.song_listen_events existing
    WHERE existing.song_id = rlp.song_id
      AND existing.stream_token = rlp.stream_token
  );

CREATE OR REPLACE FUNCTION public.prune_radio_listener_presence(
  p_older_than interval DEFAULT '24 hours',
  p_batch integer DEFAULT 20000
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
  batch_size integer;
BEGIN
  batch_size := least(greatest(coalesce(p_batch, 20000), 1), 100000);
  WITH doomed AS (
    SELECT rlp.id
    FROM public.radio_listener_presence rlp
    WHERE rlp.last_seen_at < now() - p_older_than
      AND EXISTS (
        SELECT 1
        FROM public.song_listen_events e
        WHERE e.song_id = rlp.song_id
          AND e.stream_token = rlp.stream_token
      )
    LIMIT batch_size
  )
  DELETE FROM public.radio_listener_presence
  WHERE id IN (SELECT id FROM doomed);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_radio_listener_presence(interval, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_radio_listener_presence(interval, integer) TO service_role;

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
    SELECT DISTINCT ev.song_id, 't:' || ev.stream_token
    FROM public.song_listen_events ev
    WHERE ev.song_id = ANY(p_song_ids)
      AND ev.stream_token IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = ev.stream_token
      )
  ) e
  GROUP BY e.song_id;
$$;

CREATE OR REPLACE FUNCTION public.get_ears_reached_for_songs_since(
  p_song_ids uuid[],
  p_since timestamptz
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY (p_song_ids)
      AND ps.user_id IS NOT NULL
      AND ps.started_at >= p_since
    UNION
    SELECT DISTINCT 't:' || ev.stream_token AS ear_key
    FROM public.song_listen_events ev
    WHERE ev.song_id = ANY (p_song_ids)
      AND ev.stream_token IS NOT NULL
      AND ev.started_at >= p_since
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = ev.stream_token
      )
  ) ears;
$$;

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
    SELECT DISTINCT 't:' || ev.stream_token
    FROM public.song_listen_events ev
    WHERE ev.stream_token IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = ev.stream_token
      )
    UNION
    SELECT ear_key FROM public.radio_ears_archive
  ) all_ears;
$$;

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
    SELECT DISTINCT 't:' || ev.stream_token AS ear_key
    FROM public.song_listen_events ev
    JOIN public.songs s ON s.id = ev.song_id
    WHERE s.artist_id = p_artist_id
      AND ev.stream_token IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = ev.stream_token
      )
  ) artist_ears;
$$;

CREATE OR REPLACE FUNCTION public.get_song_listen_count(p_song_ids uuid[])
RETURNS TABLE(song_id uuid, listens bigint)
LANGUAGE sql STABLE AS $$
  SELECT e.song_id, COUNT(*)::bigint AS listens
  FROM (
    SELECT DISTINCT ps.song_id, 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY(p_song_ids) AND ps.user_id IS NOT NULL
    UNION
    SELECT DISTINCT ev.song_id, 't:' || ev.stream_token AS ear_key
    FROM public.song_listen_events ev
    WHERE ev.song_id = ANY(p_song_ids) AND ev.stream_token IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.prospector_sessions ps2 WHERE ps2.stream_token = ev.stream_token)
    UNION
    SELECT DISTINCT spl.song_id, 'u:' || spl.user_id::text AS ear_key
    FROM public.song_profile_listens spl
    WHERE spl.song_id = ANY(p_song_ids) AND spl.user_id IS NOT NULL
    UNION
    SELECT DISTINCT sl.song_id, 'u:' || sl.user_id::text AS ear_key
    FROM public.spotlight_listens sl
    WHERE sl.song_id = ANY(p_song_ids)
  ) e
  GROUP BY e.song_id;
$$;

CREATE OR REPLACE FUNCTION public.get_artist_listen_count(p_artist_id uuid)
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT ps.song_id, 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    JOIN public.songs s ON s.id = ps.song_id
    WHERE s.artist_id = p_artist_id AND ps.user_id IS NOT NULL
    UNION
    SELECT DISTINCT ev.song_id, 't:' || ev.stream_token AS ear_key
    FROM public.song_listen_events ev
    JOIN public.songs s ON s.id = ev.song_id
    WHERE s.artist_id = p_artist_id AND ev.stream_token IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.prospector_sessions ps2 WHERE ps2.stream_token = ev.stream_token)
    UNION
    SELECT DISTINCT spl.song_id, 'u:' || spl.user_id::text AS ear_key
    FROM public.song_profile_listens spl
    JOIN public.songs s ON s.id = spl.song_id
    WHERE s.artist_id = p_artist_id AND spl.user_id IS NOT NULL
    UNION
    SELECT DISTINCT sl.song_id, 'u:' || sl.user_id::text AS ear_key
    FROM public.spotlight_listens sl
    JOIN public.songs s ON s.id = sl.song_id
    WHERE s.artist_id = p_artist_id
  ) artist_song_listeners;
$$;

CREATE OR REPLACE FUNCTION public.get_radio_listen_count()
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT ps.song_id, 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps WHERE ps.user_id IS NOT NULL
    UNION
    SELECT DISTINCT ev.song_id, 't:' || ev.stream_token AS ear_key
    FROM public.song_listen_events ev
    WHERE ev.stream_token IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.prospector_sessions ps2 WHERE ps2.stream_token = ev.stream_token)
    UNION
    SELECT DISTINCT spl.song_id, 'u:' || spl.user_id::text AS ear_key
    FROM public.song_profile_listens spl WHERE spl.user_id IS NOT NULL
    UNION
    SELECT DISTINCT sl.song_id, 'u:' || sl.user_id::text AS ear_key
    FROM public.spotlight_listens sl
  ) song_listeners;
$$;

CREATE OR REPLACE FUNCTION public.get_artist_listen_count_since(
  p_artist_id uuid,
  p_since timestamptz
) RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT ps.song_id, 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    JOIN public.songs s ON s.id = ps.song_id
    WHERE s.artist_id = p_artist_id AND ps.user_id IS NOT NULL AND ps.started_at >= p_since
    UNION
    SELECT DISTINCT ev.song_id, 't:' || ev.stream_token AS ear_key
    FROM public.song_listen_events ev
    JOIN public.songs s ON s.id = ev.song_id
    WHERE s.artist_id = p_artist_id AND ev.stream_token IS NOT NULL AND ev.started_at >= p_since
      AND NOT EXISTS (SELECT 1 FROM public.prospector_sessions ps2 WHERE ps2.stream_token = ev.stream_token)
    UNION
    SELECT DISTINCT spl.song_id, 'u:' || spl.user_id::text AS ear_key
    FROM public.song_profile_listens spl
    JOIN public.songs s ON s.id = spl.song_id
    WHERE s.artist_id = p_artist_id AND spl.user_id IS NOT NULL AND spl.created_at >= p_since
    UNION
    SELECT DISTINCT sl.song_id, 'u:' || sl.user_id::text AS ear_key
    FROM public.spotlight_listens sl
    JOIN public.songs s ON s.id = sl.song_id
    WHERE s.artist_id = p_artist_id AND sl.created_at >= p_since
  ) artist_song_listeners;
$$;

CREATE OR REPLACE FUNCTION public.get_artist_daily_listens(
  p_song_ids uuid[],
  p_since timestamptz
) RETURNS TABLE(day date, listens_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT d.day::date, COUNT(*)::bigint AS listens_count
  FROM (
    SELECT DISTINCT ps.song_id, date_trunc('day', ps.started_at AT TIME ZONE 'UTC')::date AS day,
      'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY(p_song_ids) AND ps.user_id IS NOT NULL AND ps.started_at >= p_since
    UNION
    SELECT DISTINCT ev.song_id, date_trunc('day', ev.started_at AT TIME ZONE 'UTC')::date AS day,
      't:' || ev.stream_token AS ear_key
    FROM public.song_listen_events ev
    WHERE ev.song_id = ANY(p_song_ids) AND ev.stream_token IS NOT NULL AND ev.started_at >= p_since
      AND NOT EXISTS (SELECT 1 FROM public.prospector_sessions ps2 WHERE ps2.stream_token = ev.stream_token)
    UNION
    SELECT DISTINCT spl.song_id, date_trunc('day', spl.created_at AT TIME ZONE 'UTC')::date AS day,
      'u:' || spl.user_id::text AS ear_key
    FROM public.song_profile_listens spl
    WHERE spl.song_id = ANY(p_song_ids) AND spl.user_id IS NOT NULL AND spl.created_at >= p_since
    UNION
    SELECT DISTINCT sl.song_id, date_trunc('day', sl.created_at AT TIME ZONE 'UTC')::date AS day,
      'u:' || sl.user_id::text AS ear_key
    FROM public.spotlight_listens sl
    WHERE sl.song_id = ANY(p_song_ids) AND sl.created_at >= p_since
  ) d
  GROUP BY d.day
  ORDER BY d.day;
$$;

CREATE OR REPLACE FUNCTION public.get_artist_daily_ears_reached(
  p_song_ids uuid[],
  p_since timestamptz
) RETURNS TABLE (day date, ears_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.day, COUNT(DISTINCT e.ear_key)::bigint AS ears_count
  FROM (
    SELECT (ps.started_at AT TIME ZONE 'UTC')::date AS day, 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY (p_song_ids) AND ps.user_id IS NOT NULL AND ps.started_at >= p_since
    UNION ALL
    SELECT (ev.started_at AT TIME ZONE 'UTC')::date AS day, 't:' || ev.stream_token AS ear_key
    FROM public.song_listen_events ev
    WHERE ev.song_id = ANY (p_song_ids) AND ev.stream_token IS NOT NULL AND ev.started_at >= p_since
      AND NOT EXISTS (SELECT 1 FROM public.prospector_sessions ps2 WHERE ps2.stream_token = ev.stream_token)
  ) e
  GROUP BY e.day
  ORDER BY e.day ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_artist_ears_reached_since(
  p_artist_id uuid,
  p_since timestamptz
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    JOIN public.songs s ON s.id = ps.song_id
    WHERE s.artist_id = p_artist_id
      AND ps.user_id IS NOT NULL
      AND ps.started_at >= p_since
    UNION
    SELECT DISTINCT 't:' || ev.stream_token AS ear_key
    FROM public.song_listen_events ev
    JOIN public.songs s ON s.id = ev.song_id
    WHERE s.artist_id = p_artist_id
      AND ev.stream_token IS NOT NULL
      AND ev.started_at >= p_since
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = ev.stream_token
      )
  ) artist_ears;
$$;

CREATE OR REPLACE FUNCTION public.get_song_recommendation_signals(p_song_ids uuid[])
RETURNS TABLE(
  song_id uuid,
  ears bigint,
  fire_votes integer,
  shit_votes integer,
  avg_listen_seconds double precision
)
LANGUAGE sql STABLE AS $$
  SELECT
    s.id AS song_id,
    COALESCE(ears.ears, 0)::bigint AS ears,
    COALESCE(st.fire_votes, 0)::integer AS fire_votes,
    COALESCE(st.shit_votes, 0)::integer AS shit_votes,
    COALESCE(listen.avg_listen_seconds, 0)::double precision AS avg_listen_seconds
  FROM public.songs s
  LEFT JOIN (
    SELECT e.song_id, COUNT(*)::bigint AS ears
    FROM (
      SELECT DISTINCT ps.song_id, 'u:' || ps.user_id::text AS ear_key
      FROM public.prospector_sessions ps
      WHERE ps.song_id = ANY (p_song_ids) AND ps.user_id IS NOT NULL
      UNION
      SELECT DISTINCT ev.song_id, 't:' || ev.stream_token AS ear_key
      FROM public.song_listen_events ev
      WHERE ev.song_id = ANY (p_song_ids) AND ev.stream_token IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.prospector_sessions ps2 WHERE ps2.stream_token = ev.stream_token)
    ) e
    GROUP BY e.song_id
  ) ears ON ears.song_id = s.id
  LEFT JOIN public.song_temperature st ON st.song_id = s.id
  LEFT JOIN (
    SELECT ps.song_id,
      AVG(LEAST(21600, GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(ps.ended_at, ps.last_heartbeat_at) - ps.started_at))))) AS avg_listen_seconds
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY (p_song_ids) AND ps.user_id IS NOT NULL
    GROUP BY ps.song_id
  ) listen ON listen.song_id = s.id
  WHERE s.id = ANY (p_song_ids);
$$;
