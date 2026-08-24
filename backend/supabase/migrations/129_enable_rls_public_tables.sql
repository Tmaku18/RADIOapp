-- Lock down tables that were exposed through PostgREST without RLS.
--
-- The anon key ships inside the mobile app and the web bundle, so every table
-- reachable by the `anon` role with RLS disabled was world-readable and
-- world-writable (subscriptions, donations, orders, chat, moderation, votes).
--
-- The backend talks to Postgres with the service_role key, which bypasses RLS,
-- so enabling RLS with no policy is a no-op for the API. Clients only use
-- Supabase directly for realtime: postgres_changes on station_events, likes and
-- service_messages (the latter two already have RLS + policies), plus broadcast
-- channels, which are unaffected by table RLS.
--
-- spatial_ref_sys is deliberately excluded: it is owned by PostGIS and holds
-- public reference data.

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'app_releases', 'artist_follows', 'artist_like_notification_settings',
    'artist_live_profiles', 'artist_live_services', 'artist_live_sessions',
    'artist_live_viewers', 'artist_spotlight', 'browse_bookmarks',
    'browse_likes', 'browse_reports', 'chat_archives', 'daily_diamonds',
    'discover_feed_post_reports', 'discover_song_likes', 'discover_swipes',
    'dj_booth_sessions', 'dj_soundboard_clips', 'leaderboard_likes',
    'live_broadcast', 'monthly_winners', 'news_promotions',
    'pro_radio_subscriptions', 'profile_clicks', 'provider_portfolio_items',
    'radio_ears_archive', 'radio_listener_presence', 'service_listings',
    'service_orders', 'service_provider_types', 'service_providers',
    'service_request_applications', 'service_requests', 'song_catalyst_credits',
    'song_featured_artists', 'song_profile_listens', 'song_temperature',
    'spotlight_listens', 'station_events', 'stream_ad_breaks',
    'stream_ad_impressions', 'stream_chat_messages', 'stream_donations',
    'user_blocks', 'user_playlist_tracks', 'user_playlists', 'user_reports',
    'venue_ads', 'weekly_votes', 'weekly_winners', 'yearly_winners'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Radio clients subscribe to rising-star inserts with the anon key, so realtime
-- needs an explicit read policy. Writes stay service-role only.
DROP POLICY IF EXISTS station_events_public_read ON public.station_events;
CREATE POLICY station_events_public_read
  ON public.station_events
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- These SECURITY DEFINER helpers run with owner rights; only the API needs them.
REVOKE EXECUTE ON FUNCTION public.allocate_credits_for_user(uuid, uuid, integer)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.allocate_credits(uuid, uuid, integer)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_credits(uuid, integer)
  FROM anon, authenticated;
