# Uptime monitor

`GET /api/health` returns **200** when Supabase answers and **503** when it does not (`status: "degraded"`). Point a monitor at both:

- `https://backend-production-17cc.up.railway.app/api/health`
- `https://www.networxradio.com`

Treat any non-200 as down. Suggested tools: UptimeRobot or Better Stack, checked every 5 minutes, with an email or Slack alert.

Also turn on billing alerts and auto-pay for Supabase, Vercel, and Railway. A paused database or a disabled Vercel project takes the radio offline even when the Nest process is running.
