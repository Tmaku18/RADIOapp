-- Set a statement_timeout on the service_role so that individual queries
-- from the NestJS backend (which uses the service_role key via supabase-js)
-- cannot run indefinitely when the database is degraded.
--
-- Without this, a single slow query can hold a connection for minutes,
-- exhausting the pool and starving the entire API.

ALTER ROLE service_role SET statement_timeout = '30s';

-- Also terminate any authenticator connections stuck in "idle in transaction"
-- so PostgREST reconnects with the latest role settings.
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE usename = 'authenticator'
  AND state = 'idle in transaction'
  AND pid <> pg_backend_pid();

-- Force PostgREST to rebuild its schema cache and pick up config changes.
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
