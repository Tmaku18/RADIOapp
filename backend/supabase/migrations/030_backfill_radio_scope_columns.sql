-- Ensure station-scoped radio columns exist in environments that missed migration 027.
alter table public.rotation_queue
  add column if not exists radio_id text;

update public.rotation_queue
set radio_id = coalesce(radio_id, 'global')
where radio_id is null;

alter table public.rotation_queue
  alter column radio_id set not null;

create index if not exists idx_rotation_queue_radio_position
  on public.rotation_queue(radio_id, position);

alter table public.radio_playlist_state
  add column if not exists radio_id text;

update public.radio_playlist_state
set radio_id = coalesce(radio_id, id)
where radio_id is null;

alter table public.radio_playlist_state
  alter column radio_id set not null;

create unique index if not exists uq_radio_playlist_state_radio_id
  on public.radio_playlist_state(radio_id);
