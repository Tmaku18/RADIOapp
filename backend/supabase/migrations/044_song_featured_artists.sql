-- Song featured-artist credits (tagging existing artists on platform)

create table if not exists public.song_featured_artists (
  song_id uuid not null references public.songs(id) on delete cascade,
  featured_user_id uuid not null references public.users(id) on delete cascade,
  added_by_user_id uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (song_id, featured_user_id)
);

create index if not exists idx_song_featured_artists_song
  on public.song_featured_artists(song_id);

create index if not exists idx_song_featured_artists_featured_user
  on public.song_featured_artists(featured_user_id);

