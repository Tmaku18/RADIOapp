# Uptime monitor

`GET /api/health` returns **200** when Supabase answers and **503** when it does not (`status: "degraded"`). The body also reports `uptime`, `supabase.latencyMs`, and `supabase.error`. Point a monitor at:

- `https://backend-production-17cc.up.railway.app/api/health` (backend directly)
- `https://www.networxradio.com/api/health` (same check through the Vercel `/api` rewrite)
- `https://www.networxradio.com`
- `https://www.pro-networx.com/pro-networx`

Treat any non-200 as down. Suggested tools: UptimeRobot or Better Stack, checked every 5 minutes, with an email or Slack alert.

Also turn on billing alerts and auto-pay for Supabase, Vercel, and Railway. A paused database or a disabled Vercel project takes the radio offline even when the Nest process is running. The mobile app calls Railway first, so a Vercel outage mostly affects the website.
