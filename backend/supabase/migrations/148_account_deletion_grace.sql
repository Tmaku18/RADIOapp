-- Self-service account deletion waits 48 hours before data is removed.
-- Signing in again during that window clears these columns and restores the account.

alter table public.users
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz;

create index if not exists idx_users_deletion_scheduled_for
  on public.users (deletion_scheduled_for)
  where deletion_scheduled_for is not null;
