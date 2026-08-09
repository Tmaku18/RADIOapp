-- Instagram-style DM message requests.
--
-- A conversation is a "request" for a viewer until they follow the sender,
-- reply in the thread, or explicitly accept it. Follows and replies are
-- derived from existing tables (user_follows / service_messages); this table
-- stores only the explicit accepts.
CREATE TABLE IF NOT EXISTS dm_conversation_accepts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  other_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, other_user_id)
);

-- Backend API uses the service role; no anon/authenticated access needed.
ALTER TABLE dm_conversation_accepts ENABLE ROW LEVEL SECURITY;
