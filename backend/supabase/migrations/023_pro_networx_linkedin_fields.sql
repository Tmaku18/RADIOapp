-- LinkedIn-style ProNetworx profile fields
ALTER TABLE pro_networx.profiles
  ADD COLUMN IF NOT EXISTS current_title TEXT,
  ADD COLUMN IF NOT EXISTS about TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS experience JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS featured JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pro_networx.profiles.current_title IS 'Professional headline / current role (LinkedIn-style).';
COMMENT ON COLUMN pro_networx.profiles.about IS 'Richer summary / about section.';
COMMENT ON COLUMN pro_networx.profiles.website_url IS 'Personal or portfolio website URL.';
COMMENT ON COLUMN pro_networx.profiles.experience IS 'Array of { title, company, location?, startDate?, endDate?, current?, description? }.';
COMMENT ON COLUMN pro_networx.profiles.education IS 'Array of { school, degree?, field?, startYear?, endYear?, description? }.';
COMMENT ON COLUMN pro_networx.profiles.featured IS 'Array of { type: "link"|"portfolio", url?, title?, description?, portfolioItemId? }.';
