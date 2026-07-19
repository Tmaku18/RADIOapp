-- Usernames: a unique handle distinct from the (non-unique) display_name.
-- Auto-generated silently for every existing user from their display name;
-- users can change it later in profile settings. Format: 3-30 chars of
-- lowercase letters, digits, underscore, dot. citext keeps lookups
-- case-insensitive so "Alex" and "alex" can't both be claimed.

create extension if not exists citext;

alter table public.users
  add column if not exists username citext;

-- Backfill a unique handle for every row that doesn't have one yet.
do $$
declare
  r record;
  base text;
  candidate text;
  suffix int;
begin
  for r in
    select id, display_name
    from public.users
    where username is null
    order by created_at asc
  loop
    base := regexp_replace(lower(coalesce(r.display_name, '')), '[^a-z0-9_.]', '', 'g');
    base := trim(both '._' from base);

    if base is null or length(base) < 3 then
      base := 'user' || substr(replace(r.id::text, '-', ''), 1, 8);
    end if;

    base := substr(base, 1, 30);
    candidate := base;
    suffix := 0;

    while exists (select 1 from public.users where username = candidate) loop
      suffix := suffix + 1;
      candidate := substr(base, 1, 29 - length(suffix::text)) || '_' || suffix::text;
    end loop;

    update public.users set username = candidate where id = r.id;
  end loop;
end $$;

create unique index if not exists idx_users_username_unique
  on public.users (username);

alter table public.users
  alter column username set not null;

alter table public.users
  drop constraint if exists users_username_format_check;
alter table public.users
  add constraint users_username_format_check
  check (username::text ~ '^[a-z0-9_.]{3,30}$');
