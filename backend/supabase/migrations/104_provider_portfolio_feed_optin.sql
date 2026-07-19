-- Browse/Discover feed opt-in + admin moderation columns for provider
-- portfolio items. These are read by both the public browse feed
-- (browse.service) and the admin feed-media moderation view (admin.service);
-- the queries were selecting/filtering on columns that no migration ever
-- created, causing "GET admin/feed-media failed" (400) and an empty browse
-- feed. Idempotent so it is safe if the columns were added out-of-band.
ALTER TABLE public.provider_portfolio_items
  ADD COLUMN IF NOT EXISTS opt_in_feed BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS feed_removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feed_removed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.provider_portfolio_items.opt_in_feed IS
  'Provider allows this item to appear in the public Browse/Discover feed.';
COMMENT ON COLUMN public.provider_portfolio_items.feed_removed_at IS
  'When an admin removed this item from the feed (NULL = visible).';
COMMENT ON COLUMN public.provider_portfolio_items.feed_removed_by IS
  'Admin user id who removed this item from the feed.';

-- Speeds up the common "opted-in and not removed" feed scan.
CREATE INDEX IF NOT EXISTS idx_provider_portfolio_feed
  ON public.provider_portfolio_items (opt_in_feed, feed_removed_at);
