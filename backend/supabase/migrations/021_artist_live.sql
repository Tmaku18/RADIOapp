-- Artist livestream foundation (Cloudflare Stream RTMP + playback lifecycle)

create table if not exists public.artist_live_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  cloudflare_live_input_uid text unique,
  stream_title text,
  stream_description text,
  category text,
  is_live_enabled boolean not null default true,
  is_live_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_live_sessions (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'starting'
    check (status in ('scheduled', 'starting', 'live', 'ended', 'failed')),
  provider text not null default 'cloudflare',
  provider_input_uid text,
  provider_video_uid text,
  rtmp_url text,
  stream_key text,
  playback_hls_url text,
  playback_dash_url text,
  watch_url text,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  peak_viewers integer not null default 0,
  current_viewers integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_artist_live_sessions_artist_created
  on public.artist_live_sessions(artist_id, created_at desc);
create index if not exists idx_artist_live_sessions_status
  on public.artist_live_sessions(status);
create index if not exists idx_artist_live_sessions_input_uid
  on public.artist_live_sessions(provider_input_uid);

create table if not exists public.artist_live_viewers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.artist_live_sessions(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  source text,
  join_token text
);

create index if not exists idx_artist_live_viewers_session
  on public.artist_live_viewers(session_id, joined_at desc);
create index if not exists idx_artist_live_viewers_user
  on public.artist_live_viewers(user_id);

create table if not exists public.stream_donations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.artist_live_sessions(id) on delete set null,
  artist_id uuid not null references public.users(id) on delete cascade,
  donor_user_id uuid references public.users(id) on delete set null,
  stripe_payment_intent_id text,
  currency text not null default 'usd',
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stream_donations_artist_created
  on public.stream_donations(artist_id, created_at desc);
create index if not exists idx_stream_donations_session
  on public.stream_donations(session_id);

create table if not exists public.stream_ad_breaks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.artist_live_sessions(id) on delete cascade,
  planned_start_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  status text not null default 'planned'
    check (status in ('planned', 'started', 'ended', 'cancelled')),
  placement text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stream_ad_breaks_session
  on public.stream_ad_breaks(session_id, created_at desc);

create table if not exists public.stream_ad_impressions (
  id uuid primary key default gen_random_uuid(),
  ad_break_id uuid references public.stream_ad_breaks(id) on delete set null,
  session_id uuid not null references public.artist_live_sessions(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_stream_ad_impressions_session
  on public.stream_ad_impressions(session_id, created_at desc);

create or replace function public.set_artist_live_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_artist_live_profiles_updated_at on public.artist_live_profiles;
create trigger trg_artist_live_profiles_updated_at
before update on public.artist_live_profiles
for each row execute function public.set_artist_live_updated_at();

drop trigger if exists trg_artist_live_sessions_updated_at on public.artist_live_sessions;
create trigger trg_artist_live_sessions_updated_at
before update on public.artist_live_sessions
for each row execute function public.set_artist_live_updated_at();

drop trigger if exists trg_stream_donations_updated_at on public.stream_donations;
create trigger trg_stream_donations_updated_at
before update on public.stream_donations
for each row execute function public.set_artist_live_updated_at();
