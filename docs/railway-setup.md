# Railway Setup Guide (RadioApp)

This guide connects the RadioApp monorepo to [Railway](https://railway.app) and configures environment variables using the Railway MCP in Cursor (`user-railway`).

## Prerequisites

- **Railway CLI** (optional): `npm install -g @railway/cli` then `railway login`
- **Railway MCP** in Cursor: enable the Railway server and authenticate (`whoami` should return your account)

## 1. Project layout (current)

| Item | Value |
|------|--------|
| Project | **RadioApp** |
| Environment | **production** |
| Primary service | **backend** (NestJS 11, `backend/Dockerfile`, Node 22 + ffmpeg) |
| Other | **Redis** (shared radio state, BullMQ push queue) |
| Public URL | `https://backend-production-17cc.up.railway.app` (port 3000) |

GitHub deploys: Railway Root Directory for the backend service must be **`backend`**.

The backend service also lists `networxradio.com` and `pro-networx.com` as custom domains. Browser traffic for both sites is served by Vercel, which reaches the backend through the Railway service domain above.

## 2. Environment variables

### Backend service (NestJS)

Set in Railway Dashboard → **RadioApp** → **backend** → **Variables**, or via MCP **`set-variables`**. Template: [railway.env.example](../railway.env.example); full list with comments: `backend/.env.example`.

| Variable | Description | Example / note |
|----------|-------------|----------------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3000` (Railway often sets this) |
| `WEB_URL` | Public web app URL (default Stripe redirects, email links) | `https://www.networxradio.com` |
| `CORS_ORIGIN` | Extra allowed origins (comma-separated) | `https://www.networxradio.com`, `https://networxradio.com`, `https://www.pro-networx.com`, `https://pro-networx.com`, and `localhost` are always allowed in `src/main.ts` |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Firebase Admin | Service account JSON fields |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Supabase | Dashboard → API |
| `DATABASE_URL` | Optional direct Postgres (transaction pooler, port 6543) for hot radio queries | A wrong value is worse than none |
| `REDIS_URL` | Redis | Railway Redis service |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe | Dashboard |
| `STRIPE_CREATOR_NETWORK_PRICE_ID` | Creator Network subscription | Stripe price ID |
| `STRIPE_PRO_NETWORX_PRICE_ID` / `STRIPE_PRO_NETWORX_INTRO_COUPON_ID` | Pro-Networx subscription | [runbooks/pro-networx-stripe.md](runbooks/pro-networx-stripe.md) |
| `STRIPE_PRO_RADIO_PRICE_ID` / `STRIPE_PRO_RADIO_INTRO_COUPON_ID` | Pro-Radio subscription | [runbooks/pro-radio-stripe.md](runbooks/pro-radio-stripe.md) |
| `STRIPE_PRO_BUNDLE_PRICE_ID` | Pro Bundle subscription | [runbooks/pro-bundle-stripe.md](runbooks/pro-bundle-stripe.md) |
| `APPLE_IAP_BUNDLE_ID` / `APPLE_IAP_ENVIRONMENT` / `APPLE_APP_APPLE_ID` / `APPLE_IAP_KEY_ID` / `APPLE_IAP_ISSUER_ID` / `APPLE_IAP_PRIVATE_KEY` | App Store purchases | `APPLE_TEAM_ID` plus the IAP key also enable Sign in with Apple token revoke on account delete |
| `GOOGLE_PLAY_PACKAGE_NAME` / `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play purchases | Package `com.tmaktechnologies.networxradio` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Sign-in text codes | In production, phone verification is enforced only when all three are set |
| `MFA_CODE_PEPPER` | Optional secret for hashing text codes | Falls back to `SUPABASE_SERVICE_KEY` |
| `EMAIL_PROVIDER` / `EMAIL_FROM` / `RESEND_API_KEY` or `SENDGRID_API_KEY` | Transactional + broadcast email | Without these, email is only logged |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_*` / `R2_PUBLIC_BASE_URL` | Optional Cloudflare R2 media storage | `R2_BUCKET_SONGS`, `_ARTWORK`, `_AVATARS`, `_FEED`, or one `R2_BUCKET_PUBLIC` |
| `ACRCLOUD_HOST` / `ACRCLOUD_ACCESS_KEY` / `ACRCLOUD_ACCESS_SECRET` | Copyright screening on upload | `COPYRIGHT_CHECK_ENABLED`, `COPYRIGHT_MATCH_THRESHOLD` |
| `GOOGLE_VISION_API_KEY` | Image moderation | `IMAGE_MODERATION_ENABLED` |
| `ELEVENLABS_API_KEY` | Lyrics alignment + STT captions | [elevenlabs.io](https://elevenlabs.io) |
| `ELEVENLABS_STT_MODEL_ID` | Optional STT model | default `scribe_v1` |
| `BETA_ALL_FREE` | Unlocks every subscription feature | Defaults to `false`; set `true` only for beta |
| `PRO_NETWORX_MESSAGING_BETA_FREE` | Free Pro-Networx DMs | Defaults to `true`; set `false` to require a subscription |
| `SENTRY_DSN` | Optional | Sentry project |
| `ADMIN_EMAILS` | Optional | comma-separated |
| `THRESHOLD_ENTER_PAID` / `THRESHOLD_EXIT_PAID` / `CHECKPOINT_INTERVAL` | Radio thresholds | `5` / `3` / `5` |

For **Artist Live** (Cloudflare Stream), also set `ARTIST_LIVE_ENABLED`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN` (or `CLOUDFLARE_API_TOKEN`), `CLOUDFLARE_STREAM_WEBHOOK_SECRET`, and `CLOUDFLARE_STREAM_CUSTOMER_CODE` or `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN`.

Full checklist: [env-variables-setup.md](env-variables-setup.md) and [production-networxradio.md](production-networxradio.md).

### Web app

Web production is on **Vercel**. Set `BACKEND_URL` / `NEXT_PUBLIC_API_URL` to the Railway backend public URL (`https://backend-production-17cc.up.railway.app`). The mobile app calls this URL directly first, then falls back to the website.

## 3. Deploy

- **GitHub (usual):** Push to the connected branch; Railway builds `backend/Dockerfile` when Root Directory = `backend`.
- **CLI:** `cd backend` then `railway up` (after `railway link`).
- **MCP:** `create-deployment` (new build) or `redeploy` (latest build) with the RadioApp project/service/environment IDs below.

### Why isn't the backend working?

- **Build failed:** Nest `npm run build` must succeed. Duplicate TypeScript symbols or dead type checks fail the Docker build; read the build logs with `get-logs`.
- **No deployments:** Trigger a deploy from Dashboard, GitHub, CLI, or MCP.
- **PORT:** App listens on `PORT` from the environment (default 3000).
- **Health check:** `GET /api/health` on the public backend URL returns `{ "status": "ok", "uptime", "supabase": { "ok", "latencyMs", "error" }, "timestamp" }`. It returns **503** with `"status": "degraded"` when Supabase does not answer. See [uptime-monitor.md](uptime-monitor.md).
- **Realtime broadcasts silent:** the image must run Node 22 or newer.

## 4. Railway MCP tools (Cursor `user-railway`)

| Tool | Use |
|------|-----|
| `whoami` | Confirm MCP login |
| `list-workspaces` / `list-projects` | Find project IDs |
| `list-services` | Services and environments in a project |
| `describe-service` / `get-service-config` | Live service config, domains, latest deployment |
| `list-deployments` / `get-status` | Recent deploys and their state |
| `get-logs` / `get-deployment-diagnosis` | Build or runtime logs for a deployment |
| `list-variables` / `set-variables` | Env vars for a service |
| `create-deployment` / `redeploy` / `restart-service` | Deploy or restart |
| `list-domains` / `generate-domain` / `domain-status` | Public domains and DNS/certificate status |
| `http-error-rate` / `http-response-time` / `get-service-metrics` | Traffic and resource health |

Linking a local folder to a service is done with the CLI (`railway link`).

Example IDs (RadioApp production backend — confirm with `list-*` if they change):

- Project: `1f3a47d3-ab6f-48ee-a1d6-547a6bd44259`
- Environment: `a5bde328-60bb-413f-a686-7d19a97fb74d` (`production`)
- Service **backend**: `ab094234-1b2b-49aa-b4aa-5bdf8054c28d`
- Service **Redis**: `8fde47a6-2bdb-4fef-a087-e5458d5bf9f9`

## 5. Local env files

- **Repo root** `.env` — Docker Compose (`env_file` for the `backend` service, plus a local `redis`); copy from `.env.example`
- **Backend** `backend/.env` — local Nest; production uses Railway variables
- **Web** `web/.env.local` — local Next; production uses Vercel

Never put secrets in docs. Prefer Dashboard or MCP for production keys with newlines (`FIREBASE_PRIVATE_KEY`).
