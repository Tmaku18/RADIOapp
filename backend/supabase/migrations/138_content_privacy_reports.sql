-- Private stories are visible to friends. Hidden stories are visible only
-- to the author. Older "private" rows meant only the author, so they become hidden.

ALTER TABLE public.song_stories
  DROP CONSTRAINT IF EXISTS song_stories_visibility_check;

UPDATE public.song_stories
SET visibility = 'hidden'
WHERE visibility = 'private';

ALTER TABLE public.song_stories
  ADD CONSTRAINT song_stories_visibility_check
  CHECK (visibility IN ('public', 'private', 'hidden'));

-- Reports for stories, posts, comments, room chat, live chat, and DMs.
-- The API uses the service role. RLS stays on with no client policies.

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_reports_type_check
    CHECK (target_type IN ('story', 'post', 'comment', 'room_chat', 'live_chat', 'message')),
  CONSTRAINT content_reports_status_check
    CHECK (status IN ('open', 'removed', 'dismissed')),
  CONSTRAINT content_reports_no_self
    CHECK (reporter_user_id <> author_user_id),
  CONSTRAINT content_reports_reason_len
    CHECK (char_length(reason) BETWEEN 1 AND 2000),
  UNIQUE (reporter_user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_content_reports_open
  ON public.content_reports (status, created_at DESC);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
