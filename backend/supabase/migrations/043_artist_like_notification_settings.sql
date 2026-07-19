-- Artist controls for song-like notifications:
-- - muted: disable all like notifications
-- - min_likes_trigger: only notify when total likes hits multiples of this number
-- - cooldown_minutes: minimum time between notifications

create table if not exists public.artist_like_notification_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  muted boolean not null default false,
  min_likes_trigger integer not null default 1 check (min_likes_trigger >= 1),
  cooldown_minutes integer not null default 0 check (cooldown_minutes >= 0),
  last_notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_artist_like_notification_settings_user_id
  on public.artist_like_notification_settings(user_id);

