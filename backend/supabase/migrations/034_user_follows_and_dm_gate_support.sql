-- Generic user follow graph for discovery + DM gating.

create table if not exists public.user_follows (
  follower_user_id uuid not null references public.users(id) on delete cascade,
  followed_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, followed_user_id),
  constraint user_follows_no_self_follow check (follower_user_id <> followed_user_id)
);

create index if not exists idx_user_follows_followed_user
  on public.user_follows (followed_user_id, created_at desc);

create index if not exists idx_user_follows_follower_user
  on public.user_follows (follower_user_id, created_at desc);

-- Backfill from legacy artist_follows (idempotent).
insert into public.user_follows (follower_user_id, followed_user_id, created_at)
select af.user_id, af.artist_id, coalesce(af.created_at, now())
from public.artist_follows af
on conflict (follower_user_id, followed_user_id) do nothing;

alter table if exists public.user_follows enable row level security;

drop policy if exists "user_follows_read_participant" on public.user_follows;
create policy "user_follows_read_participant"
  on public.user_follows
  for select
  to authenticated
  using (
    auth.uid()::uuid = follower_user_id
    or auth.uid()::uuid = followed_user_id
  );

drop policy if exists "user_follows_insert_owner" on public.user_follows;
create policy "user_follows_insert_owner"
  on public.user_follows
  for insert
  to authenticated
  with check (auth.uid()::uuid = follower_user_id);

drop policy if exists "user_follows_delete_owner" on public.user_follows;
create policy "user_follows_delete_owner"
  on public.user_follows
  for delete
  to authenticated
  using (auth.uid()::uuid = follower_user_id);
