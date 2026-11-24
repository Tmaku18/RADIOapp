-- Admin can take a copyright-flagged song off sale. The buy button reads
-- is_for_sale, and demonetized stops the artist from turning sales back on.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS demonetized boolean NOT NULL DEFAULT false;
