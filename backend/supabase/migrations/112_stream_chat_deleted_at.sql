-- Track when a stream chat message was soft-deleted so poll clients can
-- receive tombstones (deletedIds) and drop moderated messages for everyone.
alter table public.stream_chat_messages
  add column if not exists deleted_at timestamptz;

create index if not exists idx_stream_chat_session_deleted_at
  on public.stream_chat_messages(session_id, deleted_at)
  where is_deleted = true;
