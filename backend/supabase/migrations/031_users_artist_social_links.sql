-- Add artist social links to user profiles (Spotify-style artist pages).
alter table public.users
  add column if not exists instagram_url text,
  add column if not exists twitter_url text,
  add column if not exists youtube_url text,
  add column if not exists tiktok_url text,
  add column if not exists website_url text;
