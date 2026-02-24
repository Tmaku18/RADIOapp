-- Migration: PRO-NETWORX profiles + skills (separate schema, same Supabase project)
--
-- Purpose:
-- - Keep Pro directory profile fields separate from Radio feature tables
-- - Still link to shared identity rows in public.users (same Firebase auth)

CREATE SCHEMA IF NOT EXISTS pro_networx;

-- ---------------------------------------------------------------------------
-- 1) Pro profile core
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pro_networx.profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_for_work BOOLEAN NOT NULL DEFAULT TRUE,
  skills_headline TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_networx_profiles_available
  ON pro_networx.profiles(available_for_work, updated_at DESC);

COMMENT ON TABLE pro_networx.profiles IS 'PRO-NETWORX profile fields scoped to the Pro directory.';

-- ---------------------------------------------------------------------------
-- 2) Skill taxonomy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pro_networx.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_networx_skills_category
  ON pro_networx.skills(category, name);

COMMENT ON TABLE pro_networx.skills IS 'Skill taxonomy used for filtering PRO-NETWORX directory.';

-- ---------------------------------------------------------------------------
-- 3) Profile <-> skills mapping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pro_networx.profile_skills (
  user_id UUID NOT NULL REFERENCES pro_networx.profiles(user_id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES pro_networx.skills(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_pro_networx_profile_skills_skill
  ON pro_networx.profile_skills(skill_id, created_at DESC);

COMMENT ON TABLE pro_networx.profile_skills IS 'Many-to-many mapping between Pro profiles and skills.';

-- Seed an initial skill set (idempotent)
INSERT INTO pro_networx.skills (name, category)
VALUES
  ('artist', 'music'),
  ('producer', 'music'),
  ('studio', 'music'),
  ('mixing', 'audio'),
  ('mastering', 'audio'),
  ('graphic_designer', 'visual'),
  ('photographer', 'visual'),
  ('videographer', 'visual'),
  ('social_media_manager', 'marketing'),
  ('manager', 'business'),
  ('booking', 'business')
ON CONFLICT (name) DO NOTHING;

