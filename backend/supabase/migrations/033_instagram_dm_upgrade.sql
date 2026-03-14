-- Instagram-style DM foundation:
-- - rich media message metadata
-- - reactions
-- - read state / unread counters
-- - dm-media storage bucket for direct uploads

alter table if exists public.service_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_url text,
  add column if not exists media_mime text,
  add column if not exists media_duration_ms integer,
  add column if not exists reply_to_message_id uuid references public.service_messages(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists unsent_at timestamptz;

alter table if exists public.service_messages
  drop constraint if exists service_messages_message_type_check;
alter table if exists public.service_messages
  add constraint service_messages_message_type_check
  check (message_type in ('text', 'image', 'video', 'voice'));

create index if not exists idx_service_messages_pair_created_at
  on public.service_messages (sender_id, recipient_id, created_at desc);
create index if not exists idx_service_messages_recipient_created_at
  on public.service_messages (recipient_id, created_at desc);
create index if not exists idx_service_messages_reply_to
  on public.service_messages (reply_to_message_id);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.service_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists idx_message_reactions_message
  on public.message_reactions (message_id);
create index if not exists idx_message_reactions_user
  on public.message_reactions (user_id);

create table if not exists public.message_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  other_user_id uuid not null references public.users(id) on delete cascade,
  last_read_message_id uuid references public.service_messages(id) on delete set null,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, other_user_id),
  check (user_id <> other_user_id)
);

create index if not exists idx_message_reads_user_other
  on public.message_reads (user_id, other_user_id);
create index if not exists idx_message_reads_last_read_at
  on public.message_reads (user_id, last_read_at desc);

-- Enable row level security for DM tables used by Realtime subscriptions.
alter table if exists public.service_messages enable row level security;
alter table if exists public.message_reactions enable row level security;
alter table if exists public.message_reads enable row level security;

drop policy if exists "participants_can_read_service_messages" on public.service_messages;
create policy "participants_can_read_service_messages"
  on public.service_messages
  for select
  using (
    auth.uid()::uuid = sender_id
    or auth.uid()::uuid = recipient_id
  );

drop policy if exists "participants_can_insert_service_messages" on public.service_messages;
create policy "participants_can_insert_service_messages"
  on public.service_messages
  for insert
  with check (
    auth.uid()::uuid = sender_id
    and auth.uid()::uuid <> recipient_id
  );

drop policy if exists "participants_can_update_own_or_received_messages" on public.service_messages;
create policy "participants_can_update_own_or_received_messages"
  on public.service_messages
  for update
  using (
    auth.uid()::uuid = sender_id
    or auth.uid()::uuid = recipient_id
  )
  with check (
    auth.uid()::uuid = sender_id
    or auth.uid()::uuid = recipient_id
  );

drop policy if exists "participants_can_read_reactions" on public.message_reactions;
create policy "participants_can_read_reactions"
  on public.message_reactions
  for select
  using (
    exists (
      select 1
      from public.service_messages sm
      where sm.id = message_id
        and (sm.sender_id = auth.uid()::uuid or sm.recipient_id = auth.uid()::uuid)
    )
  );

drop policy if exists "participants_can_insert_reactions" on public.message_reactions;
create policy "participants_can_insert_reactions"
  on public.message_reactions
  for insert
  with check (
    auth.uid()::uuid = user_id
    and exists (
      select 1
      from public.service_messages sm
      where sm.id = message_id
        and (sm.sender_id = auth.uid()::uuid or sm.recipient_id = auth.uid()::uuid)
    )
  );

drop policy if exists "participants_can_delete_own_reactions" on public.message_reactions;
create policy "participants_can_delete_own_reactions"
  on public.message_reactions
  for delete
  using (
    auth.uid()::uuid = user_id
  );

drop policy if exists "owner_can_read_message_reads" on public.message_reads;
create policy "owner_can_read_message_reads"
  on public.message_reads
  for select
  using (auth.uid()::uuid = user_id);

drop policy if exists "owner_can_insert_message_reads" on public.message_reads;
create policy "owner_can_insert_message_reads"
  on public.message_reads
  for insert
  with check (auth.uid()::uuid = user_id);

drop policy if exists "owner_can_update_message_reads" on public.message_reads;
create policy "owner_can_update_message_reads"
  on public.message_reads
  for update
  using (auth.uid()::uuid = user_id)
  with check (auth.uid()::uuid = user_id);

-- Storage bucket for DM attachments.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dm-media',
  'dm-media',
  true,
  26214400,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/webm',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg',
    'audio/wav',
    'audio/x-wav'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow uploads to dm-media bucket" on storage.objects;
create policy "Allow uploads to dm-media bucket"
  on storage.objects
  for insert
  with check (bucket_id = 'dm-media');

drop policy if exists "Public read for dm-media bucket" on storage.objects;
create policy "Public read for dm-media bucket"
  on storage.objects
  for select
  using (bucket_id = 'dm-media');
