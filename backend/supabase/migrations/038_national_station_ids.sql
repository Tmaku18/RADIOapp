-- Move regional GA station IDs to national genre station IDs.
-- Keep this idempotent so re-running is safe.

-- songs.station_id
update public.songs
set station_id = case station_id
  when 'ga-nw-rap' then 'us-rap'
  when 'ga-atl-hip-hop' then 'us-hip-hop'
  when 'ga-north-country' then 'us-country'
  when 'ga-west-rock' then 'us-rock'
  when 'ga-east-pop' then 'us-pop'
  when 'ga-ne-edm' then 'us-edm'
  when 'ga-sw-rnb' then 'us-rnb'
  when 'ga-se-podcasts' then 'us-podcasts'
  when 'ga-central-spoken-word' then 'us-spoken-word'
  when 'ga-coast-comedian' then 'us-comedian'
  when 'default' then 'us-rap'
  when 'global' then 'us-rap'
  else station_id
end
where station_id in (
  'ga-nw-rap',
  'ga-atl-hip-hop',
  'ga-north-country',
  'ga-west-rock',
  'ga-east-pop',
  'ga-ne-edm',
  'ga-sw-rnb',
  'ga-se-podcasts',
  'ga-central-spoken-word',
  'ga-coast-comedian',
  'default',
  'global'
);

alter table if exists public.songs
alter column station_id set default 'us-rap';

-- admin_fallback_songs.radio_id
update public.admin_fallback_songs
set radio_id = case radio_id
  when 'ga-nw-rap' then 'us-rap'
  when 'ga-atl-hip-hop' then 'us-hip-hop'
  when 'ga-north-country' then 'us-country'
  when 'ga-west-rock' then 'us-rock'
  when 'ga-east-pop' then 'us-pop'
  when 'ga-ne-edm' then 'us-edm'
  when 'ga-sw-rnb' then 'us-rnb'
  when 'ga-se-podcasts' then 'us-podcasts'
  when 'ga-central-spoken-word' then 'us-spoken-word'
  when 'ga-coast-comedian' then 'us-comedian'
  when 'default' then 'us-rap'
  when 'global' then 'us-rap'
  else radio_id
end
where radio_id in (
  'ga-nw-rap',
  'ga-atl-hip-hop',
  'ga-north-country',
  'ga-west-rock',
  'ga-east-pop',
  'ga-ne-edm',
  'ga-sw-rnb',
  'ga-se-podcasts',
  'ga-central-spoken-word',
  'ga-coast-comedian',
  'default',
  'global'
);

-- radio playlist state + queue scope
update public.radio_playlist_state
set radio_id = case radio_id
  when 'ga-nw-rap' then 'us-rap'
  when 'ga-atl-hip-hop' then 'us-hip-hop'
  when 'ga-north-country' then 'us-country'
  when 'ga-west-rock' then 'us-rock'
  when 'ga-east-pop' then 'us-pop'
  when 'ga-ne-edm' then 'us-edm'
  when 'ga-sw-rnb' then 'us-rnb'
  when 'ga-se-podcasts' then 'us-podcasts'
  when 'ga-central-spoken-word' then 'us-spoken-word'
  when 'ga-coast-comedian' then 'us-comedian'
  when 'default' then 'us-rap'
  when 'global' then 'us-rap'
  else radio_id
end
where radio_id in (
  'ga-nw-rap',
  'ga-atl-hip-hop',
  'ga-north-country',
  'ga-west-rock',
  'ga-east-pop',
  'ga-ne-edm',
  'ga-sw-rnb',
  'ga-se-podcasts',
  'ga-central-spoken-word',
  'ga-coast-comedian',
  'default',
  'global'
);

update public.rotation_queue
set radio_id = case radio_id
  when 'ga-nw-rap' then 'us-rap'
  when 'ga-atl-hip-hop' then 'us-hip-hop'
  when 'ga-north-country' then 'us-country'
  when 'ga-west-rock' then 'us-rock'
  when 'ga-east-pop' then 'us-pop'
  when 'ga-ne-edm' then 'us-edm'
  when 'ga-sw-rnb' then 'us-rnb'
  when 'ga-se-podcasts' then 'us-podcasts'
  when 'ga-central-spoken-word' then 'us-spoken-word'
  when 'ga-coast-comedian' then 'us-comedian'
  when 'default' then 'us-rap'
  when 'global' then 'us-rap'
  else radio_id
end
where radio_id in (
  'ga-nw-rap',
  'ga-atl-hip-hop',
  'ga-north-country',
  'ga-west-rock',
  'ga-east-pop',
  'ga-ne-edm',
  'ga-sw-rnb',
  'ga-se-podcasts',
  'ga-central-spoken-word',
  'ga-coast-comedian',
  'default',
  'global'
);
