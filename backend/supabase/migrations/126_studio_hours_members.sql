-- Studio hours + bookable producers/artists on a studio page.

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS hours JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN studios.hours IS
  'Weekly hours: [{ day, open, close, closed }]. Empty means hours not listed.';

CREATE TABLE IF NOT EXISTS studio_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_id, user_id)
);

CREATE INDEX IF NOT EXISTS studio_members_studio_idx
  ON studio_members (studio_id, sort_order);

COMMENT ON TABLE studio_members IS
  'Producers and artists who take bookings at this studio.';

ALTER TABLE studio_members ENABLE ROW LEVEL SECURITY;
