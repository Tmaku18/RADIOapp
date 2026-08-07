-- Beta: songs already cleared for free-rotation radio are streamable to
-- Pro-Radio playlists. Without this, Add-to-playlist from live radio fails
-- for most of the catalog (only the handful with opt_in_full_song_radio
-- were covered by migration 120).

UPDATE public.songs
SET opt_in_pro_radio = TRUE
WHERE admin_free_rotation = TRUE
  AND COALESCE(product_kind, 'song') <> 'beat'
  AND opt_in_pro_radio = FALSE;
