-- Drop unused decision-log indexes and prune rows older than two weeks in batches.
-- Empty stations used to insert one row per song; the table was over a million rows.

DROP INDEX IF EXISTS public.idx_play_decision_log_reason;
DROP INDEX IF EXISTS public.idx_play_decision_log_selected_at;

CREATE OR REPLACE FUNCTION public.prune_play_decision_log(
  p_older_than interval,
  p_batch integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  IF p_batch IS NULL OR p_batch < 1 OR p_batch > 100000 THEN
    p_batch := 20000;
  END IF;
  WITH doomed AS (
    SELECT id
    FROM public.play_decision_log
    WHERE created_at < now() - p_older_than
    LIMIT p_batch
  )
  DELETE FROM public.play_decision_log
  WHERE id IN (SELECT id FROM doomed);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_play_decision_log(interval, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_play_decision_log(interval, integer) TO service_role;
