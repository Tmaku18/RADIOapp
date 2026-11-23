# Environment Variables Setup (Vercel + Railway)

**Production on networxradio.com:** For the full checklist (DNS, Vercel, Railway, Firebase, Stripe) with both **networxradio.com** and **www.networxradio.com** required, see [production-networxradio.md](production-networxradio.md).

**Copy-paste source:** Use `docs/env-variables.local` for raw key=value lines (fill placeholders, then paste into Railway/Vercel). That file is **gitignored** so you can put real values there safely. `railway.env.example` at the repo root lists the core names.

**Complete backend reference:** [`backend/ENV_REQUIREMENTS.md`](../backend/ENV_REQUIREMENTS.md) lists every variable the backend reads, with defaults.

---

## Railway (backend)

Set these on the Railway **backend** service (Dashboard → project → **backend** → **Variables**, or the Cursor **Railway MCP**: `list-variables` / `set-variables`).

### Non-secret configuration

| Variable | Value |
|----------|--------|
| `NODE_ENV` | production |
| `PORT` | 3000 |
| `WEB_URL` | https://networxradio.com |
| `CORS_ORIGIN` | Optional extra origins. networxradio.com and pro-networx.com (with and without `www`) are built in |
| `SUPABASE_URL` | https://tgjydsqeatvcerzpdqup.supabase.co |
| `THRESHOLD_ENTER_PAID` | 5 |
| `THRESHOLD_EXIT_PAID` | 3 |
| `CHECKPOINT_INTERVAL` | 5 |
| `APPLE_IAP_BUNDLE_ID` / `GOOGLE_PLAY_PACKAGE_NAME` | com.tmaktechnologies.networxradio |
| `APPLE_IAP_ENVIRONMENT` | `Production` for App Store builds, `Sandbox` for TestFlight |

### Secrets

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (or `FIREBASE_SERVICE_ACCOUNT_PATH` to a mounted JSON)
- `SUPABASE_SERVICE_KEY`
- `DATABASE_URL` (direct Postgres connection)
- `REDIS_URL` (Railway Redis; required for shared radio state across instances and the push queue)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
- Stripe prices: `STRIPE_PRO_RADIO_PRICE_ID`, `STRIPE_PRO_NETWORX_PRICE_ID`, `STRIPE_PRO_BUNDLE_PRICE_ID`, `STRIPE_CREATOR_NETWORK_PRICE_ID` (+ optional intro coupon IDs)
- Store billing: `APPLE_APP_APPLE_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY`, `APPLE_TEAM_ID`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- Sign-in codes: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `MFA_CODE_PEPPER`
- `ELEVENLABS_API_KEY` — synced lyrics force-alignment + STT auto-captions ([ElevenLabs](https://elevenlabs.io)); `ELEVENLABS_STT_MODEL_ID` optional (default `scribe_v1`)
- `ACRCLOUD_HOST`, `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_ACCESS_SECRET` — copyright detection
- `GOOGLE_VISION_API_KEY` — image moderation
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_CUSTOMER_CODE`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET` — live streaming
- `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` or `SENDGRID_API_KEY`
- `SENTRY_DSN` (optional)
- `ADMIN_EMAILS` (optional, comma-separated)
- `R2_*` (optional Cloudflare R2 media mirror)

Feature switches such as `BETA_ALL_FREE`, `PRO_NETWORX_MESSAGING_BETA_FREE`, and `ARTIST_LIVE_ENABLED` are described in `backend/ENV_REQUIREMENTS.md`.

---

## Vercel (web app) – set in Dashboard

The **Vercel MCP does not provide a tool to set environment variables.** Copy the Vercel block from `docs/env-variables.local` (replace placeholders), then paste into Vercel Dashboard → the web project (root directory `web/`) → **Settings** → **Environment Variables**. The same project serves www.networxradio.com and www.pro-networx.com.

Add these for **Production** (and Preview if you want):

| Variable | Description | Example |
|----------|-------------|---------|
| `BACKEND_URL` | Backend origin for the `/api` rewrite and API route proxies | `https://backend-production-17cc.up.railway.app` |
| `NEXT_PUBLIC_API_URL` | Backend origin used by the browser for direct uploads | Same as above |
| `NEXT_PUBLIC_SITE_URL` | Canonical public origin (falls back to `NEXT_PUBLIC_APP_URL`) | `https://www.networxradio.com` |
| `NEXT_PUBLIC_PRO_NETWORX_APP_URL` | Pro-Networx origin | `https://www.pro-networx.com` |
| `NEXT_PUBLIC_IOS_APP_URL` | App Store listing URL (optional) | From App Store Connect |
| `NEXT_PUBLIC_ANDROID_APP_URL` | Play Store listing URL (optional) | From Play Console |
| `ANDROID_APP_LINK_SHA256` | Extra signing-cert fingerprints for `/.well-known/assetlinks.json` (optional) | From Play Console → App signing |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase analytics (optional) | From Firebase Console |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Server-side: full JSON of service account (session cookies) | From Firebase Console (Generate key) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://tgjydsqeatvcerzpdqup.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | From Supabase Dashboard → API |

Redeploy the Vercel project after adding or changing variables.

---

## Mobile (`mobile/.env`)

Bundled into the app as a Flutter asset. Template: `mobile/.env.example`.

| Variable | Description |
|----------|-------------|
| `API_BASE_URL` | Website origin (`https://www.networxradio.com`); also used for web embeds |
| `API_DIRECT_URL` | Backend origin tried first (Railway). Set to a local backend for development |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase Realtime |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Payment Sheet |
| `SENTRY_DSN` | Optional crash reporting |
| `RADIO_STATION_ID` | Optional default station (default `us-ready-now-rap`) |
| `ANDROID_PLAY_*_PRODUCT_ID`, `IOS_APP_STORE_SONG_PLAYS_PRICE_PRODUCT_MAP_JSON` | Optional store product overrides (see `mobile/README.md`) |
