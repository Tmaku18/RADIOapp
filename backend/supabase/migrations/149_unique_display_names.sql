-- Display names are unique, and a numbered copy of a taken name is not a new name.
-- Letters-and-digits keys ignore case, spaces, and punctuation, so
-- "DJ Nova", "dj nova", and "dj_nova" all reserve the same name.
-- The oldest account keeps a duplicated display name. Later copies are
-- disambiguated once so the unique index can be created.

DO $$
DECLARE
  r record;
  candidate text;
  compact text;
  n int;
BEGIN
  FOR r IN
    SELECT id,
           display_name,
           row_number() OVER (
             PARTITION BY regexp_replace(lower(coalesce(display_name, '')), '[^a-z0-9]', '', 'g')
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.users
    WHERE regexp_replace(lower(coalesce(display_name, '')), '[^a-z0-9]', '', 'g') <> ''
  LOOP
    IF r.rn = 1 THEN
      CONTINUE;
    END IF;
    n := r.rn;
    LOOP
      candidate := left(btrim(r.display_name), 36) || ' ' || n::text;
      compact := regexp_replace(lower(candidate), '[^a-z0-9]', '', 'g');
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.users other
        WHERE other.id <> r.id
          AND regexp_replace(lower(coalesce(other.display_name, '')), '[^a-z0-9]', '', 'g') = compact
      );
      n := n + 1;
    END LOOP;
    UPDATE public.users SET display_name = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name_compact text
  GENERATED ALWAYS AS (
    nullif(regexp_replace(lower(coalesce(display_name, '')), '[^a-z0-9]', '', 'g'), '')
  ) STORED;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username_compact text
  GENERATED ALWAYS AS (
    nullif(regexp_replace(lower(username::text), '[^a-z0-9]', '', 'g'), '')
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_compact_unique
  ON public.users (display_name_compact)
  WHERE display_name_compact IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_compact_unique
  ON public.users (username_compact)
  WHERE username_compact IS NOT NULL;
