-- Fan emails collected on an artist page. The API uses the service role.
-- Row level security stays on with no policies, so the browser cannot read the list.

CREATE TABLE IF NOT EXISTS public.artist_fans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_fans_email_chk CHECK (char_length(email) BETWEEN 3 AND 254)
);

CREATE UNIQUE INDEX IF NOT EXISTS artist_fans_artist_email_uidx
  ON public.artist_fans (artist_id, email);

CREATE INDEX IF NOT EXISTS artist_fans_artist_created
  ON public.artist_fans (artist_id, created_at DESC);

ALTER TABLE public.artist_fans ENABLE ROW LEVEL SECURITY;
