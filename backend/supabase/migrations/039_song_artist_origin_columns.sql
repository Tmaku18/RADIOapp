-- Store artist origin per uploaded song for on-air display.

alter table if exists public.songs
add column if not exists artist_origin_city text;

alter table if exists public.songs
add column if not exists artist_origin_state text;

create index if not exists idx_songs_artist_origin_state
  on public.songs (artist_origin_state)
  where artist_origin_state is not null;
