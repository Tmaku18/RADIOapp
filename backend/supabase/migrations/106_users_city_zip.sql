-- City / ZIP for Nearby People map pins and directory lists.
-- Coordinates stay on artist_lat / artist_lng (geocoded from city/zip on profile update).

alter table if exists public.users
add column if not exists city text;

alter table if exists public.users
add column if not exists zip_code text;

create index if not exists idx_users_city_lower
  on public.users (lower(city))
  where city is not null and length(trim(city)) > 0;

create index if not exists idx_users_zip_code
  on public.users (zip_code)
  where zip_code is not null and length(trim(zip_code)) > 0;

-- Best-effort backfill: first comma segment of location_region → city.
update public.users
set city = nullif(trim(split_part(location_region, ',', 1)), '')
where city is null
  and location_region is not null
  and length(trim(location_region)) > 0;
