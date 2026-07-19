-- Live stream chat (Twitch-style) for artist/DJ live sessions.
create table if not exists public.stream_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.artist_live_sessions(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  display_name text not null,
  avatar_url text,
  message text not null,
  is_host boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_stream_chat_session_created
  on public.stream_chat_messages(session_id, created_at);
