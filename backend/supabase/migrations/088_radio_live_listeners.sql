-- Live listeners = unique accounts/devices tuned in within the heartbeat window.
-- Replaces unused Redis LISTENER_COUNT counters for marketing/home stats.

CREATE OR REPLACE FUNCTION public.get_radio_live_listeners(
  p_window_seconds integer DEFAULT 120
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT DISTINCT 'u:' || ps.user_id::text AS ear_key
    FROM public.prospector_sessions ps
    WHERE ps.user_id IS NOT NULL
      AND ps.ended_at IS NULL
      AND ps.last_heartbeat_at >= NOW() - make_interval(secs => GREATEST(30, p_window_seconds))
    UNION
    SELECT DISTINCT 't:' || rlp.stream_token AS ear_key
    FROM public.radio_listener_presence rlp
    WHERE rlp.stream_token IS NOT NULL
      AND rlp.last_seen_at >= NOW() - make_interval(secs => GREATEST(30, p_window_seconds))
      AND NOT EXISTS (
        SELECT 1 FROM public.prospector_sessions ps2
        WHERE ps2.stream_token = rlp.stream_token
          AND ps2.ended_at IS NULL
          AND ps2.last_heartbeat_at >= NOW() - make_interval(secs => GREATEST(30, p_window_seconds))
      )
  ) live_now;
$$;

GRANT EXECUTE ON FUNCTION public.get_radio_live_listeners(integer) TO anon, authenticated, service_role;
