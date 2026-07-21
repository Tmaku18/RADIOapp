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
| Primary service | **backend** (NestJS, Dockerfile in `backend/`) |
| Other | **Redis**, optional **backend Copy** |

GitHub deploys: Railway Root Directory for the backend service must be **`backend`**.

## 2. Environment variables

### Backend service (NestJS)

Set in Railway Dashboard → **RadioApp** → **backend** → **Variables**, or via MCP **`set_variables`**.

| Variable | Description | Example / note |
|----------|-------------|----------------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3000` (Railway often sets this) |
| `WEB_URL` | Public web app URL | `https://networxradio.com` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `https://networxradio.com,https://www.networxradio.com` |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Firebase Admin | Service account JSON fields |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Supabase | Dashboard → API |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_CREATOR_NETWORK_PRICE_ID` | Stripe | Dashboard |
| `REDIS_URL` | Redis | Railway Redis plugin |
| `ELEVENLABS_API_KEY` | Lyrics alignment + STT captions | [elevenlabs.io](https://elevenlabs.io) |
| `ELEVENLABS_STT_MODEL_ID` | Optional STT model | default `scribe_v1` |
| `SENTRY_DSN` | Optional | Sentry project |
| `ADMIN_EMAILS` | Optional | comma-separated |
| `THRESHOLD_ENTER_PAID` / `THRESHOLD_EXIT_PAID` / `CHECKPOINT_INTERVAL` | Radio thresholds | `5` / `3` / `5` |

For **Artist Live** (Cloudflare Stream), also set `ARTIST_LIVE_ENABLED`, `CLOUDFLARE_ACCOUNT_ID`, stream API token, webhook secret.

Full checklist: [env-variables-setup.md](env-variables-setup.md) and [production-networxradio.md](production-networxradio.md).

### Web app

Web production is on **Vercel**, not Railway. Set `BACKEND_URL` / `NEXT_PUBLIC_API_URL` to the Railway backend public URL (e.g. `https://backend-production-17cc.up.railway.app`).

## 3. Deploy

- **GitHub (usual):** Push to the connected branch; Railway builds `backend/Dockerfile` when Root Directory = `backend`.
- **CLI:** `cd backend` then `railway up` (after `railway link`).
- **MCP:** `deploy` with the RadioApp project/service/environment IDs (see tools below).

### Why isn’t the backend working?

- **Build failed:** Nest `npm run build` must succeed. Duplicate TypeScript symbols (e.g. methods) fail the Docker build.
- **No deployments:** Trigger a deploy from Dashboard, GitHub, CLI, or MCP.
- **PORT:** App listens on `PORT` from the environment.
- **Health check:** `GET /api/health` on the public backend URL should return `{ "status": "ok", ... }`.

## 4. Railway MCP tools (Cursor `user-railway`)

Auth and discovery:

| Tool | Use |
|------|-----|
| `whoami` | Confirm MCP login |
| `list_workspaces` / `list_projects` | Find project IDs |
| `list_services` | Services in a project (`project_id`) |
| `list_deployments` | Recent deploys (`project_id`, `service_id`, `environment_id`, `limit`) |
| `get_logs` | Build or runtime logs for a deployment |
| `list_variables` / `set_variables` | Env vars for a service |
| `deploy` | Trigger a deploy |
| `list_domains` / `generate_domain` | Public domains |
| `link_service` / `link_environment` | Link local workspace to Railway |

Example IDs (RadioApp production backend — confirm with `list_*` if they change):

- Project: `1f3a47d3-ab6f-48ee-a1d6-547a6bd44259`
- Environment: `a5bde328-60bb-413f-a686-7d19a97fb74d` (`production`)
- Service **backend**: `ab094234-1b2b-49aa-b4aa-5bdf8054c28d`

## 5. Local env files

- **Repo root** `.env` — Docker Compose (`env_file`); copy from `.env.example`
- **Backend** `backend/.env` — local Nest; production uses Railway variables
- **Web** `web/.env.local` — local Next; production uses Vercel

Never commit secrets. Prefer Dashboard or MCP for production keys with newlines (`FIREBASE_PRIVATE_KEY`).
