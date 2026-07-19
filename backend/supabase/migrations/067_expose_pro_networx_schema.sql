-- Expose pro_networx schema to PostgREST and grant rights to backend roles.
-- Without this, the supabase-js client cannot read or write any of the
-- pro_networx.* tables and silently fails (404), which manifests as the
-- ProNetworx onboarding form "saving" but never persisting.

GRANT USAGE ON SCHEMA pro_networx TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA pro_networx TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA pro_networx TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA pro_networx TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pro_networx TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pro_networx TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pro_networx TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA pro_networx TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA pro_networx GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA pro_networx GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA pro_networx GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- Allow PostgREST to discover the schema.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, pro_networx';
ALTER ROLE postgres SET pgrst.db_schemas = 'public, graphql_public, pro_networx';

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
