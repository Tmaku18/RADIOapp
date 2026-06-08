-- Comprehensive RLS hardening for pivot branch (extends 085/086).
-- Uses current_app_user_id() for policies that need the app users.id FK.

-- notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- song_purchases
ALTER TABLE public.song_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Buyers read own song purchases" ON public.song_purchases;
CREATE POLICY "Buyers read own song purchases"
  ON public.song_purchases FOR SELECT
  TO authenticated
  USING (user_id = public.current_app_user_id());

-- creator_network_subscriptions
ALTER TABLE public.creator_network_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own creator network sub" ON public.creator_network_subscriptions;
CREATE POLICY "Users read own creator network sub"
  ON public.creator_network_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = public.current_app_user_id());

-- pro_network_subscriptions
ALTER TABLE public.pro_network_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own pro network sub" ON public.pro_network_subscriptions;
CREATE POLICY "Users read own pro network sub"
  ON public.pro_network_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = public.current_app_user_id());

-- service_messages (participant read)
ALTER TABLE public.service_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants read service messages" ON public.service_messages;
CREATE POLICY "Participants read service messages"
  ON public.service_messages FOR SELECT
  TO authenticated
  USING (
    sender_id = public.current_app_user_id()
    OR recipient_id = public.current_app_user_id()
  );

DROP POLICY IF EXISTS "Senders insert service messages" ON public.service_messages;
CREATE POLICY "Senders insert service messages"
  ON public.service_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = public.current_app_user_id());

-- discover_feed_posts (author read/write own)
ALTER TABLE public.discover_feed_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authors manage own feed posts" ON public.discover_feed_posts;
CREATE POLICY "Authors manage own feed posts"
  ON public.discover_feed_posts FOR ALL
  TO authenticated
  USING (author_id = public.current_app_user_id())
  WITH CHECK (author_id = public.current_app_user_id());

-- discover_feed_post_likes
ALTER TABLE public.discover_feed_post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own feed post likes" ON public.discover_feed_post_likes;
CREATE POLICY "Users manage own feed post likes"
  ON public.discover_feed_post_likes FOR ALL
  TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- discover_feed_post_bookmarks
ALTER TABLE public.discover_feed_post_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own feed bookmarks" ON public.discover_feed_post_bookmarks;
CREATE POLICY "Users manage own feed bookmarks"
  ON public.discover_feed_post_bookmarks FOR ALL
  TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- pro_networx.profiles (owner)
ALTER TABLE pro_networx.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read own pro profile" ON pro_networx.profiles;
CREATE POLICY "Owners read own pro profile"
  ON pro_networx.profiles FOR SELECT
  TO authenticated
  USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Owners update own pro profile" ON pro_networx.profiles;
CREATE POLICY "Owners update own pro profile"
  ON pro_networx.profiles FOR UPDATE
  TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- plays + rotation_queue: remain deny-all for authenticated clients (backend/worker only).
COMMENT ON TABLE public.plays IS 'RLS deny-all: radio worker / service role only.';
COMMENT ON TABLE public.rotation_queue IS 'RLS deny-all: radio worker / service role only.';
