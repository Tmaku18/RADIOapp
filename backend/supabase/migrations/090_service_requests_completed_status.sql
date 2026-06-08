-- Allow service requests (Pro-Network job board) to be marked "completed" by
-- their owner, in addition to the existing open/closed states.
ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_status_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_status_check
  CHECK (status IN ('open', 'closed', 'completed'));
