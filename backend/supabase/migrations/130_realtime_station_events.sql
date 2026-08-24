-- The `supabase_realtime` publication was empty, so every postgres_changes
-- subscription in the apps received nothing. Rising-star station events are the
-- one case that is safe to publish: the rows are public by design and
-- station_events already has an anon SELECT policy (see 129).
--
-- The other two subscriptions (public.likes for the global like counter,
-- public.service_messages for DM refresh) are intentionally NOT published:
-- clients connect as `anon` (auth is Firebase, not Supabase auth), so realtime
-- would deliver nothing anyway, and opening those tables to anon would leak
-- private likes and direct messages. Those features need a backend-driven
-- broadcast instead.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'station_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.station_events;
  END IF;
END $$;
