-- Per-type social notification prefs + server-side master kill switch.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notify_new_follower boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_feed_post_like boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;
