-- Add station/category ownership for songs so playback can be station-scoped.
alter table if exists public.songs
add column if not exists station_id text;

-- Backfill all existing songs to Rap station.
update public.songs
set station_id = 'ga-nw-rap'
where station_id is null or btrim(station_id) = '';

alter table if exists public.songs
alter column station_id set default 'ga-nw-rap';

alter table if exists public.songs
alter column station_id set not null;

-- Indexes for station-scoped playback and queue eligibility checks.
create index if not exists idx_songs_station_status_admin_rotation
  on public.songs (station_id, status, admin_free_rotation);

create index if not exists idx_songs_station_status_credits
  on public.songs (station_id, status, credits_remaining, trial_plays_remaining);

-- Clear stale non-rap queue stacks so empty stations stay idle until uploads arrive.
update public.radio_playlist_state
set fallback_stack = '[]'::jsonb,
    fallback_position = 0,
    stack_version_hash = null,
    updated_at = now()
where radio_id in (
  'ga-ne-edm',
  'ga-sw-rnb',
  'ga-se-podcasts',
  'ga-central-spoken-word',
  'ga-coast-comedian'
);
