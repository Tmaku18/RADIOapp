-- Add a dedicated "dj" role so users can host Live DJ broadcasts (audio + video).
-- DJs reuse the existing artist_live (Cloudflare Stream) pipeline; this just lets
-- the users.role column hold 'dj' and gate the new Live DJ tab + go-live flow.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('listener', 'artist', 'admin', 'service_provider', 'dj'));
