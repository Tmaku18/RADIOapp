# Railway Setup Guide (RadioApp)

This guide connects the RadioApp monorepo to [Railway](https://railway.app) and configures environment variables using the Railway MCP in Cursor.

## Prerequisites

- **Railway CLI** is installed globally: `npm install -g @railway/cli`
- **Logged in**: Run `railway login` in a terminal (opens browser). Do this once; the MCP uses the same auth.

## 1. Connect the app to Railway

After `railway login`:

1. In Cursor, use the **Railway MCP** (or run in terminal):
   - **Create project and link**: Creates a Railway project and links this repo.
     - Project name: e.g. `RadioApp`
     - Workspace path: `c:\Users\tmaku\OneDrive\Documents\GSU\Projects\RadioApp` (this repo root)
   - Or link an existing project: from repo root run `railway link` and choose project/environment.

2. **Link services** (if you have separate backend/web):
   - From `backend/`: `railway link` (or use MCP **link-service** with `workspacePath` = backend folder) to link the backend service.
   - From `web/`: repeat for the web app if you deploy it as a separate service.

3. **Link environment**: Use MCP **link-environment** with `environmentName` (e.g. `production`) and the same `workspacePath` you use for the service.

## 2. Environment variables

### Backend service (NestJS)

Set these in Railway (Dashboard → your backend service → Variables, or via MCP **set-variables**).

Use the same names as in `backend/.env.example`. For production, set:

| Variable | Description | Example / note |
|----------|-------------|----------------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3000` (Railway often sets this automatically) |
| `WEB_URL` | Public URL of the web app | Your Railway web URL or custom domain |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `https://yourapp.up.railway.app,https://yourdomain.com` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | From Firebase Console |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | From Firebase service account JSON |
| `FIREBASE_PRIVATE_KEY` | Firebase private key (escaped newlines) | From Firebase service account JSON |
| `SUPABASE_URL` | Supabase project URL | From Supabase Dashboard → API |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | From Supabase Dashboard → API |
| `STRIPE_SECRET_KEY` | Stripe secret key | From Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | From Stripe webhook |
| `STRIPE_CREATOR_NETWORK_PRICE_ID` | Stripe price ID for Creator Network | From Stripe |
| `REDIS_URL` | Redis connection URL | Use Railway Redis plugin or external (e.g. Upstash) |
| `SENTRY_DSN` | Sentry DSN (optional) | From Sentry project settings |
| `ADMIN_EMAILS` | Comma-separated admin emails | Optional |
| `THRESHOLD_ENTER_PAID` | Radio: listeners to enter paid | `5` |
| `THRESHOLD_EXIT_PAID` | Radio: listeners to exit paid | `3` |
| `CHECKPOINT_INTERVAL` | Radio: checkpoint every N songs | `5` |

For **Artist Live** (Cloudflare Stream), also set:

- `ARTIST_LIVE_ENABLED` = `true`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_API_TOKEN` or `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_STREAM_WEBHOOK_SECRET`

### Web app (Next.js)

If you deploy the Next.js app as a separate Railway service, set in that service:

- `BACKEND_URL` = your backend Railway URL (e.g. `https://backend-xxx.up.railway.app`)
- All `NEXT_PUBLIC_*` vars from `web/.env.local.example` (Firebase, Supabase, Stripe, etc.)
- `NEXT_PUBLIC_WEB_URL` = public URL of this web app

### Setting variables via Railway MCP

Once the project and service are linked:

- **set-variables** (Railway MCP): `workspacePath` = path to the app (e.g. backend or web folder), `variables` = array of `"KEY=value"` strings.
- Use placeholders for secrets if you prefer to fill them in the Railway Dashboard.
- For multi-line or sensitive values (e.g. `FIREBASE_PRIVATE_KEY`), set them in the Railway Dashboard to avoid escaping issues.

## 3. Local env files (for reference)

- **Repo root**: `.env` – used by Docker Compose; copy from `.env.example`.
- **Backend**: `backend/.env` – copy from `backend/.env.example`; for production deploy, rely on Railway variables instead of committing `.env`.
- **Web**: `web/.env.local` – copy from `web/.env.local.example`; for production, set the same keys in Railway (web service) or your hosting env.

After deployment, set `WEB_URL` and `CORS_ORIGIN` (and any `NEXT_PUBLIC_*` that point to your backend) to your real Railway URLs.

## 4. Deploy

- **From CLI (recommended for first deploy):** From the backend folder run `railway up`. The backend service is linked to `backend/` and has a `Dockerfile` there, so Railway will build and deploy from that directory.
- **From Cursor:** Use Railway MCP **deploy** with `workspacePath` = path to `backend` (e.g. `c:\...\RadioApp\backend`). If you see "operation timed out", try again from a stable network or deploy from the CLI instead.
- **From GitHub:** In Railway Dashboard → backend service → Settings → set **Root Directory** to `backend` so the service builds from that folder (where the Dockerfile lives). Push to the connected branch to trigger a deploy.
- Generate a public domain in Railway (Dashboard or MCP **generate-domain**) and use that URL in `WEB_URL` and `CORS_ORIGIN`.

### Why isn’t the backend working?

- **No deployments found:** The backend service has no successful deployment yet. Trigger a deploy (see above). If **deploy** times out, use the CLI: `cd backend` then `railway up`.
- **PORT:** The app listens on `PORT` from the environment (Railway sets this automatically).
- **Build:** The Dockerfile builds NestJS and runs `node dist/src/main.js`; ensure you’re deploying from the `backend` directory (or Root Directory = `backend` when using GitHub).

## Quick reference: Railway MCP tools

| Tool | Use |
|------|-----|
| `check-railway-status` | Verify CLI installed and logged in |
| `list-projects` | List your Railway projects |
| `create-project-and-link` | Create project and link this repo (projectName, workspacePath) |
| `link-service` | Link a service to a folder (workspacePath, optional serviceName) |
| `link-environment` | Link to an environment (workspacePath, environmentName) |
| `list-services` | List services in the linked project |
| `set-variables` | Set env vars (workspacePath, variables as `["KEY=value", ...]`) |
| `list-variables` | List current variables |
| `generate-domain` | Generate a public domain for a service |
| `deploy` | Deploy the linked service |

Workspace path for this repo (Windows): `c:\Users\tmaku\OneDrive\Documents\GSU\Projects\RadioApp` (use `backend` or `web` subfolder when linking a single service).
