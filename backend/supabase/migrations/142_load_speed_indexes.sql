-- Notification badge and list scans were reading ~1.1M rows. These indexes
-- cover the unread count and the per-user list. The stream-token index lets
-- the listener-count functions skip a full scan of prospector_sessions.
-- CONCURRENTLY cannot run inside a transaction.
create index concurrently if not exists idx_notifications_user_unread
  on public.notifications (user_id) where read = false and deleted_at is null;
create index concurrently if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc) where deleted_at is null;
create index concurrently if not exists idx_prospector_sessions_stream_token
  on public.prospector_sessions (stream_token) where stream_token is not null;
-- Lets the daily prune find old automated notices without scanning the table.
create index concurrently if not exists idx_notifications_automated_created
  on public.notifications (created_at)
  where type in (
    'song_played',
    'artist_song_on_radio',
    'song_up_next',
    'song_up_next_5min'
  );

-- Deletes one batch of automated radio notices older than the cutoff.
-- Called by the daily cleanup job and the one-time prune. Service role only.
create or replace function public.prune_automated_notifications(
  p_older_than interval,
  p_batch integer
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted integer;
  batch_size integer;
begin
  batch_size := least(greatest(coalesce(p_batch, 50000), 1), 100000);
  with doomed as (
    select id
    from public.notifications
    where type in (
      'song_played',
      'artist_song_on_radio',
      'song_up_next',
      'song_up_next_5min'
    )
      and created_at < now() - p_older_than
    limit batch_size
    for update skip locked
  )
  delete from public.notifications n
  using doomed
  where n.id = doomed.id;

  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function public.prune_automated_notifications(interval, integer)
  from public, anon, authenticated;
grant execute on function public.prune_automated_notifications(interval, integer)
  to service_role;
