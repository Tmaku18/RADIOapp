-- Add a dedicated "musician" role so users can host Live Performances (audio +
-- video). Musicians reuse the existing artist_live (Cloudflare Stream) pipeline;
-- this just lets users.role hold 'musician' and gate the Live Performances tab +
-- go-live-as-musician flow.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('listener', 'artist', 'admin', 'service_provider', 'dj', 'musician'));
