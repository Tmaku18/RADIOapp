-- My Songs stats count plays per song. A covering index lets that count come
-- from the index alone instead of visiting every scattered play row.
create index concurrently if not exists idx_plays_song_stats
  on public.plays (song_id) include (listener_count, played_at);
