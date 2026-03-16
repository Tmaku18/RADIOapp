-- Add artist geo coordinates for discovery map heat/clusters.
-- Keep nullable for progressive rollout.

alter table if exists public.users
add column if not exists artist_lat double precision;

alter table if exists public.users
add column if not exists artist_lng double precision;

create index if not exists idx_users_artist_lat_lng
  on public.users (artist_lat, artist_lng)
  where artist_lat is not null and artist_lng is not null;

-- Best-effort backfill from service_provider coords when present.
update public.users u
set
  artist_lat = coalesce(u.artist_lat, sp.lat),
  artist_lng = coalesce(u.artist_lng, sp.lng)
from public.service_providers sp
where sp.user_id = u.id
  and (
    u.artist_lat is null
    or u.artist_lng is null
  )
  and sp.lat is not null
  and sp.lng is not null;
