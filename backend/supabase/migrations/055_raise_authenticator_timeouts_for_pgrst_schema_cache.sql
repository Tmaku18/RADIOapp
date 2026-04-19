-- Raise the `authenticator` role's statement_timeout / lock_timeout so that
-- PostgREST is able to load its schema cache without aborting.
--
-- Background:
--   PostgREST uses the `authenticator` Postgres role for its admin connection,
--   which is the connection that introspects pg_catalog (tables, columns, FKs,
--   RLS policies, etc.) to build its in-memory schema cache. With ~50 tables
--   and a fair amount of RLS in this project, that introspection query can
--   take longer than the Supabase default 8s `statement_timeout`. When it does,
--   PostgREST never finishes building its schema cache and every REST call
--   responds with HTTP 503 and:
--     "Could not query the database for the schema cache. Retrying."
--
--   That manifested in this app as the entire backend (radio, /users/me,
--   /users/me/check-admin) hanging until the per-request timeouts fired.
--
-- These per-role settings only apply to *new* `authenticator` connections, so
-- after rolling this out we also terminate any existing PostgREST sessions to
-- force them to reconnect with the new limits.

ALTER ROLE authenticator SET statement_timeout = '60s';
ALTER ROLE authenticator SET lock_timeout = '60s';

-- Ask PostgREST to reload schema + config now that it has more headroom.
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
