-- Automatic copyright-infringement screening for uploaded songs.
-- Each upload is fingerprinted (ACRCloud) and the outcome is recorded here.

ALTER TABLE public.songs
  -- Lifecycle of the automated check:
  --   pending  -> queued / not yet run
  --   checking -> provider request in flight
  --   clear    -> no commercial match found
  --   flagged  -> matched a known commercial recording (likely infringement)
  --   error    -> provider/network failure (left for retry or manual review)
  --   skipped  -> screening disabled / no provider configured
  ADD COLUMN IF NOT EXISTS copyright_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS copyright_checked_at timestamptz,
  -- Best match details from the provider (title, artist, score, external ids, raw payload).
  ADD COLUMN IF NOT EXISTS copyright_match jsonb;

-- Speed up dashboards / cron that scan by screening state.
CREATE INDEX IF NOT EXISTS idx_songs_copyright_status
  ON public.songs (copyright_status);
