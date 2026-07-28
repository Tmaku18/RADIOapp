-- Reset song favorites (⭐). Fire/likes (🔥) live in `likes` and must stay there.
-- Radio on-air / up-next alerts fan out only to song_favorites, so emptying this
-- table stops star alerts until users intentionally star again. No notification
-- rows are written by this migration.

TRUNCATE TABLE public.song_favorites;

COMMENT ON TABLE public.song_favorites IS
  'User-starred songs for radio alerts only. Separate from likes (🔥). Never backfill from likes.';
