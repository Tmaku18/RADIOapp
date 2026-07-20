-- Device tokens for FCM push (used by PushNotificationService).
CREATE TABLE IF NOT EXISTS public.user_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  device_type text NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id
  ON public.user_device_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_device_type
  ON public.user_device_tokens (device_type);

COMMENT ON TABLE public.user_device_tokens IS
  'FCM registration tokens for mobile (and optional web) push delivery.';

-- Published app versions for update prompts + optional broadcast pushes.
CREATE TABLE IF NOT EXISTS public.app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'all'
    CHECK (platform IN ('ios', 'android', 'all')),
  latest_version text NOT NULL,
  latest_build integer,
  min_version text,
  title text NOT NULL DEFAULT 'Update available',
  body text NOT NULL DEFAULT 'A new version of NETWORX Radio is ready.',
  store_url text,
  force_update boolean NOT NULL DEFAULT false,
  broadcast_push boolean NOT NULL DEFAULT false,
  broadcast_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_releases_platform_created
  ON public.app_releases (platform, created_at DESC);

COMMENT ON TABLE public.app_releases IS
  'Latest/min app versions for soft/force update prompts and release broadcast pushes.';
