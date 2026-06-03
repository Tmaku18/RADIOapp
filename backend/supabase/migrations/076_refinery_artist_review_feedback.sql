-- The Refinery: let the song's artist favorite reviews and rate the quality of
-- the feedback they received. These are artist-owned annotations on each
-- review row (only the song owner can set them).

alter table public.refinery_reviews
  add column if not exists artist_favorited boolean not null default false;

alter table public.refinery_reviews
  add column if not exists artist_quality_rating smallint
  check (artist_quality_rating between 1 and 5);

-- Favorited reviews are surfaced at the top of the artist's analytics, so make
-- that lookup cheap.
create index if not exists idx_refinery_reviews_song_favorited
  on public.refinery_reviews(song_id, artist_favorited);
