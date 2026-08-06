-- Pro-Radio on-demand streaming rights. Artists accept this as part of the
-- all-rights upload checkbox (alongside live radio + DJ rights).
-- Backfill from existing full-song radio opt-in so already-uploaded catalog
-- is streamable to Pro-Radio subscribers.

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS opt_in_pro_radio BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.songs
SET opt_in_pro_radio = TRUE
WHERE opt_in_full_song_radio = TRUE
  AND opt_in_pro_radio = FALSE;

COMMENT ON COLUMN public.songs.opt_in_pro_radio IS
  'Artist authorized interactive Pro-Radio on-demand streaming to subscribers. Set with the all-rights upload opt-in.';
