-- Share-to-DM: allow a feed post to be sent into a direct message.
-- Adds a new message_type 'post_share' plus a reference to the shared post.
-- See 033_instagram_dm_upgrade.sql for the base message_type set.

alter table if exists public.service_messages
  add column if not exists shared_post_id uuid
    references public.discover_feed_posts(id) on delete set null;

alter table if exists public.service_messages
  drop constraint if exists service_messages_message_type_check;
alter table if exists public.service_messages
  add constraint service_messages_message_type_check
  check (message_type in ('text', 'image', 'video', 'voice', 'post_share'));

create index if not exists idx_service_messages_shared_post
  on public.service_messages (shared_post_id);
