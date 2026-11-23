-- Extra context on a suspicious-account flag so admin can see what the flood was.
ALTER TABLE public.activity_flags
  ADD COLUMN IF NOT EXISTS detail text;
