-- Backfill song-level artist origin from existing user profile location fields.
-- This is best-effort and only fills missing values.

with user_origin as (
  select
    u.id as user_id,
    nullif(btrim(split_part(coalesce(u.location_region, ''), ',', 1)), '') as city_from_location,
    nullif(btrim(split_part(coalesce(u.location_region, ''), ',', 2)), '') as state_from_location,
    nullif(btrim(split_part(coalesce(u.region, ''), ',', 1)), '') as city_from_region,
    nullif(btrim(split_part(coalesce(u.region, ''), ',', 2)), '') as state_from_region,
    nullif(btrim(u.location_region), '') as raw_location,
    nullif(btrim(u.region), '') as raw_region
  from public.users u
)
update public.songs s
set
  artist_origin_city = coalesce(
    nullif(btrim(s.artist_origin_city), ''),
    o.city_from_location,
    case
      when position(',' in coalesce(o.raw_region, '')) > 0 then o.city_from_region
      else null
    end
  ),
  artist_origin_state = coalesce(
    nullif(btrim(s.artist_origin_state), ''),
    o.state_from_location,
    case
      when position(',' in coalesce(o.raw_region, '')) > 0 then o.state_from_region
      when coalesce(o.raw_location, '') ~ '^[A-Za-z]{2}$' then upper(o.raw_location)
      when coalesce(o.raw_region, '') ~ '^[A-Za-z]{2}$' then upper(o.raw_region)
      when coalesce(o.raw_location, '') like 'US-%' then nullif(btrim(split_part(o.raw_location, '-', 2)), '')
      when coalesce(o.raw_region, '') like 'US-%' then nullif(btrim(split_part(o.raw_region, '-', 2)), '')
      else null
    end
  )
from user_origin o
where s.artist_id = o.user_id
  and (
    s.artist_origin_city is null
    or btrim(s.artist_origin_city) = ''
    or s.artist_origin_state is null
    or btrim(s.artist_origin_state) = ''
  );
