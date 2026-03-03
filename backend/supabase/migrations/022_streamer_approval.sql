-- Streamer approval: artists/Catalysts must apply and be approved by admin to go live.
-- Only users with streaming_approved_at set (or admin role) can start a livestream.

alter table public.artist_live_profiles
  add column if not exists streaming_applied_at timestamptz,
  add column if not exists streaming_approved_at timestamptz,
  add column if not exists streaming_rejected_at timestamptz;

comment on column public.artist_live_profiles.streaming_applied_at is 'When the user applied to become a streamer (null = never applied)';
comment on column public.artist_live_profiles.streaming_approved_at is 'When admin approved streaming (null = not approved); only then can user go live';
comment on column public.artist_live_profiles.streaming_rejected_at is 'When admin rejected the application (optional)';
