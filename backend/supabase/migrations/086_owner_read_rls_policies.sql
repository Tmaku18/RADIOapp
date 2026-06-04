-- Owner-scoped, read-only RLS policies for tables that had RLS enabled but no
-- policies. The NestJS backend uses the service role (bypasses RLS) for all
-- writes and cross-user reads; clients only ever read their OWN row via these
-- policies. auth.uid() is the Firebase UID (= users.firebase_uid), wrapped in
-- a subselect so it's evaluated once per query.
--
-- Note: `plays` and `rotation_queue` are intentionally left with no policies
-- (deny-all). They hold no per-user data (song/radio-keyed analytics and
-- scheduling) and are accessed exclusively by the backend service role.

-- users: read your own profile row.
drop policy if exists "Users read own row" on public.users;
create policy "Users read own row"
  on public.users for select
  to authenticated
  using ((select auth.uid())::text = firebase_uid);

-- transactions: read your own purchase history.
drop policy if exists "Users read own transactions" on public.transactions;
create policy "Users read own transactions"
  on public.transactions for select
  to authenticated
  using (
    (select auth.uid())::text = (
      select firebase_uid from public.users where id = user_id
    )
  );

-- subscriptions: an artist reads their own subscription.
drop policy if exists "Artists read own subscriptions" on public.subscriptions;
create policy "Artists read own subscriptions"
  on public.subscriptions for select
  to authenticated
  using (
    (select auth.uid())::text = (
      select firebase_uid from public.users where id = artist_id
    )
  );

-- songs: an artist reads their own tracks. Public catalog reads for listeners
-- are served by the backend (service role); this only scopes direct client
-- reads to the owning artist.
drop policy if exists "Artists read own songs" on public.songs;
create policy "Artists read own songs"
  on public.songs for select
  to authenticated
  using (
    (select auth.uid())::text = (
      select firebase_uid from public.users where id = artist_id
    )
  );
