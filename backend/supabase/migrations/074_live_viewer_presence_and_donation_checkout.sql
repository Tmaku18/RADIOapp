-- Accurate concurrent-viewer presence + web donation checkout support.

-- Track a last-seen heartbeat per viewer so we can compute live concurrent
-- viewers (rows whose left_at is null and last_seen_at is recent), instead of a
-- monotonically increasing join counter.
alter table public.artist_live_viewers
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists idx_artist_live_viewers_session_seen
  on public.artist_live_viewers(session_id, last_seen_at desc);

-- Web donations go through Stripe Checkout (redirect). Track the checkout
-- session id so the payments webhook can mark the donation succeeded.
alter table public.stream_donations
  add column if not exists stripe_checkout_session_id text;

create index if not exists idx_stream_donations_checkout
  on public.stream_donations(stripe_checkout_session_id);
