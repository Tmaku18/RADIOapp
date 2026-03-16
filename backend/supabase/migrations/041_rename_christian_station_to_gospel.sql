-- Rename national Christian station to Gospel.
-- Keep idempotent and safe for mixed deployments.

update public.songs
set station_id = 'us-gospel'
where station_id = 'us-christian';

update public.admin_fallback_songs
set radio_id = 'us-gospel'
where radio_id = 'us-christian';

update public.radio_playlist_state
set radio_id = 'us-gospel'
where radio_id = 'us-christian';

update public.rotation_queue
set radio_id = 'us-gospel'
where radio_id = 'us-christian';
