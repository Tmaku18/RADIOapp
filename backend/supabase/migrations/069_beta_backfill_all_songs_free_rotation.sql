-- Beta: place every existing non-rejected song into free rotation so the radio
-- queue is populated across all stations. This mirrors the upload-time behavior
-- gated by BETA_AUTO_FREE_ROTATION in SongsService.
--
-- Free-rotation playback eligibility requires:
--   status = 'approved' AND is_public = true AND admin_free_rotation = true
-- so we set all three here. Rejected songs are intentionally left untouched to
-- preserve explicit moderation decisions.
--
-- After beta (when plays are charged), free rotation becomes an artist/admin
-- toggle; this one-time backfill is not re-run.

UPDATE songs
SET
  admin_free_rotation = TRUE,
  is_public = TRUE,
  status = 'approved',
  updated_at = now()
WHERE status <> 'rejected'
  AND (
    admin_free_rotation IS DISTINCT FROM TRUE
    OR is_public IS DISTINCT FROM TRUE
    OR status <> 'approved'
  );

-- Ask PostgREST to reload in case the radio worker is reading via the Data API.
NOTIFY pgrst, 'reload schema';
