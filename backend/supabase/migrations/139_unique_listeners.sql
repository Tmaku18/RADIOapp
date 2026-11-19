-- Ears Reached stays all-time unique people (one account per song, one guest
-- session per song). Unique listeners count every time a song is heard.
-- Signed-in listens are prospector_sessions rows (a loop starts a new session).
-- Guest loops are song_listen_events; the same open session does not insert
-- another row, so a loop cannot add a second ear.

CREATE TABLE IF NOT EXISTS public.song_listen_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  stream_token TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_song_listen_events_song_started
  ON public.song_listen_events(song_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_song_listen_events_token
  ON public.song_listen_events(stream_token);

ALTER TABLE public.song_listen_events ENABLE ROW LEVEL SECURITY;

-- One historical guest listen per presence row. Later loops append events.
INSERT INTO public.song_listen_events (song_id, stream_token, started_at)
SELECT rlp.song_id, rlp.stream_token, rlp.created_at
FROM public.radio_listener_presence rlp
WHERE rlp.stream_token IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.prospector_sessions ps
    WHERE ps.stream_token = rlp.stream_token
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.song_listen_events existing
    WHERE existing.song_id = rlp.song_id
      AND existing.stream_token = rlp.stream_token
      AND existing.started_at = rlp.created_at
  );

-- Distinct people who heard these songs since a timestamp. A person counts
-- once in the window, not once per day.
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
    SELECT DISTINCT 't:' || rlp.stream_token AS ear_key
    FROM public.radio_listener_presence rlp
    WHERE rlp.song_id = ANY (p_song_ids)
      AND rlp.stream_token IS NOT NULL
      AND rlp.created_at >= p_since
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = rlp.stream_token
      )
  ) ears;
$$;

GRANT EXECUTE ON FUNCTION public.get_ears_reached_for_songs_since(uuid[], timestamptz)
  TO anon, authenticated, service_role;

-- Every listen: each signed-in session plus each guest start that is not
-- already represented by a signed-in session on the same device token.
CREATE OR REPLACE FUNCTION public.get_unique_listener_count(
  p_song_ids uuid[],
  p_since timestamptz DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT (
    SELECT COUNT(*)::bigint
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY (p_song_ids)
      AND ps.user_id IS NOT NULL
      AND (p_since IS NULL OR ps.started_at >= p_since)
  ) + (
    SELECT COUNT(*)::bigint
    FROM public.song_listen_events e
    WHERE e.song_id = ANY (p_song_ids)
      AND (p_since IS NULL OR e.started_at >= p_since)
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = e.stream_token
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_unique_listener_count(uuid[], timestamptz)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_daily_unique_listeners(
  p_song_ids uuid[],
  p_since timestamptz
)
RETURNS TABLE(day date, listeners_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT d.day, SUM(d.n)::bigint AS listeners_count
  FROM (
    SELECT
      (ps.started_at AT TIME ZONE 'UTC')::date AS day,
      COUNT(*)::bigint AS n
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY (p_song_ids)
      AND ps.user_id IS NOT NULL
      AND ps.started_at >= p_since
    GROUP BY 1
    UNION ALL
    SELECT
      (e.started_at AT TIME ZONE 'UTC')::date AS day,
      COUNT(*)::bigint AS n
    FROM public.song_listen_events e
    WHERE e.song_id = ANY (p_song_ids)
      AND e.started_at >= p_since
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = e.stream_token
      )
    GROUP BY 1
  ) d
  GROUP BY d.day
  ORDER BY d.day;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_unique_listeners(uuid[], timestamptz)
  TO anon, authenticated, service_role;

-- Signals for radio selection: unique people, likes, dislikes, average listen time.
CREATE OR REPLACE FUNCTION public.get_song_recommendation_signals(
  p_song_ids uuid[]
)
RETURNS TABLE(
  song_id uuid,
  ears bigint,
  fire_votes integer,
  shit_votes integer,
  avg_listen_seconds double precision
)
LANGUAGE sql
STABLE
AS $$
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
      WHERE ps.song_id = ANY (p_song_ids)
        AND ps.user_id IS NOT NULL
      UNION
      SELECT DISTINCT rlp.song_id, 't:' || rlp.stream_token AS ear_key
      FROM public.radio_listener_presence rlp
      WHERE rlp.song_id = ANY (p_song_ids)
        AND rlp.stream_token IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.prospector_sessions ps2
          WHERE ps2.stream_token = rlp.stream_token
        )
    ) e
    GROUP BY e.song_id
  ) ears ON ears.song_id = s.id
  LEFT JOIN public.song_temperature st ON st.song_id = s.id
  LEFT JOIN (
    SELECT
      ps.song_id,
      AVG(
        LEAST(
          21600,
          GREATEST(
            0,
            EXTRACT(EPOCH FROM (COALESCE(ps.ended_at, ps.last_heartbeat_at) - ps.started_at))
          )
        )
      ) AS avg_listen_seconds
    FROM public.prospector_sessions ps
    WHERE ps.song_id = ANY (p_song_ids)
      AND ps.user_id IS NOT NULL
    GROUP BY ps.song_id
  ) listen ON listen.song_id = s.id
  WHERE s.id = ANY (p_song_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_song_recommendation_signals(uuid[])
  TO service_role;
