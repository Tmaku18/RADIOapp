-- Add additional artist social links to user profiles.
alter table public.users
  add column if not exists soundcloud_url text,
  add column if not exists spotify_url text,
  add column if not exists apple_music_url text,
  add column if not exists facebook_url text,
  add column if not exists snapchat_url text;
