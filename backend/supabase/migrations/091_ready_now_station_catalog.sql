-- Move the New School Rap catalog onto Ready Now Radio and empty us-rap.
-- Idempotent: safe to re-run; only touches songs still assigned to us-rap.

UPDATE public.songs s
SET
  station_ids = calc.new_ids,
  station_id = CASE
    WHEN s.station_id = 'us-rap' THEN COALESCE(
      (SELECT x FROM unnest(calc.new_ids) AS x WHERE x = 'us-ready-now-rap' LIMIT 1),
      (SELECT x FROM unnest(calc.new_ids) AS x LIMIT 1),
      'us-ready-now-rap'
    )
    ELSE s.station_id
  END,
  updated_at = NOW()
FROM (
  SELECT
    id,
    array_remove(
      CASE
        WHEN NOT ('us-ready-now-rap' = ANY(base_ids)) THEN base_ids || ARRAY['us-ready-now-rap']
        ELSE base_ids
      END,
      'us-rap'
    ) AS new_ids
  FROM (
    SELECT
      id,
      COALESCE(station_ids, ARRAY[station_id]) AS base_ids
    FROM public.songs
    WHERE station_id = 'us-rap'
       OR 'us-rap' = ANY(COALESCE(station_ids, ARRAY[]::text[]))
  ) sub
) calc
WHERE s.id = calc.id;
