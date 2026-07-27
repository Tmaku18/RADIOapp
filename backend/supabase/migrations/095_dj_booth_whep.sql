-- DJ Booth: WHEP playback URL for mic sessions.
-- WHIP-ingested Cloudflare live inputs can only be played back via WHEP
-- (WebRTC), never HLS/DASH, so listeners need this URL.

ALTER TABLE dj_booth_sessions
  ADD COLUMN IF NOT EXISTS whep_playback_url TEXT;
