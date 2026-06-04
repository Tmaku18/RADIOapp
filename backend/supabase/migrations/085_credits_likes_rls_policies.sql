-- Add owner-scoped RLS policies for `credits` and `likes`. Both tables had RLS
-- enabled but no policies (flagged by the security advisor), which denies all
-- access through the authenticated/anon keys. The backend uses the service
-- role and bypasses RLS; these policies govern direct client (web/mobile)
-- access. auth.uid() is the Firebase UID, mapped to users.firebase_uid.
-- auth.uid() is wrapped in a subselect so it's evaluated once per query.

-- credits: an artist may read only their own balance. All credit mutations
-- happen server-side via the service role, so no client write policies.
drop policy if exists "Artists read own credits" on public.credits;
create policy "Artists read own credits"
  on public.credits for select
  to authenticated
  using (
    (select auth.uid())::text = (
      select firebase_uid from public.users where id = artist_id
    )
  );

-- likes: a user may read, create, and remove their own song likes. Aggregate
-- like counts are served by the backend (service role), so reads here are
-- scoped to the owner's own like state.
drop policy if exists "Users read own likes" on public.likes;
create policy "Users read own likes"
  on public.likes for select
  to authenticated
  using (
    (select auth.uid())::text = (
      select firebase_uid from public.users where id = user_id
    )
  );

drop policy if exists "Users like as themselves" on public.likes;
create policy "Users like as themselves"
  on public.likes for insert
  to authenticated
  with check (
    (select auth.uid())::text = (
      select firebase_uid from public.users where id = user_id
    )
  );

drop policy if exists "Users remove own likes" on public.likes;
create policy "Users remove own likes"
  on public.likes for delete
  to authenticated
  using (
    (select auth.uid())::text = (
      select firebase_uid from public.users where id = user_id
    )
  );
