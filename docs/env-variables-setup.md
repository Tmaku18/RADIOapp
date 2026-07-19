# Environment Variables Setup (Vercel + Railway)

**Production on networxradio.com:** For the full checklist (DNS, Vercel, Railway, Firebase, Stripe) with both **networxradio.com** and **www.networxradio.com** required, see [production-networxradio.md](production-networxradio.md).

**Copy-paste source:** Use `docs/env-variables.local` for raw key=value lines (fill placeholders, then paste into Railway/Vercel). That file is **gitignored** so you can put real values there safely.

---

## Railway (backend) – set via MCP ✅

These are **already set** on the Railway **backend** service via the Railway MCP:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | production |
| `PORT` | 3000 |
| `WEB_URL` | https://networxradio.com |
| `CORS_ORIGIN` | https://networxradio.com,https://www.networxradio.com |
| `SUPABASE_URL` | https://tgjydsqeatvcerzpdqup.supabase.co |
| `THRESHOLD_ENTER_PAID` | 5 |
| `THRESHOLD_EXIT_PAID` | 3 |
| `CHECKPOINT_INTERVAL` | 5 |

### Add these in Railway Dashboard (secrets)

In [Railway](https://railway.app) → **RadioApp** → **backend** → **Variables**, add:

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (or use a service account file)
- `SUPABASE_SERVICE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CREATOR_NETWORK_PRICE_ID`
- `REDIS_URL` (e.g. Railway Redis plugin or Upstash)
- `SENTRY_DSN` (optional)
- `ADMIN_EMAILS` (optional, comma-separated)

After the backend has a public URL, add it to `CORS_ORIGIN` in Railway if needed.

---

## Vercel (web app) – no MCP; set in Dashboard

The **Vercel MCP does not provide a tool to set environment variables.** Copy the Vercel block from `docs/env-variables.local` (replace placeholders), then paste into:

[Vercel Dashboard](https://vercel.com) → **DiscoverMe Radio Group LLC** → project **radi-oapp** → **Settings** → **Environment Variables**.

Add these for **Production** (and Preview if you want):

| Variable | Description | Example |
|----------|-------------|---------|
| `BACKEND_URL` | Backend API URL | Your Railway backend URL (e.g. `https://backend-xxx.up.railway.app`) |
| `NEXT_PUBLIC_API_URL` | Same as BACKEND_URL for client | Same as above |
| `NEXT_PUBLIC_WEB_URL` | Public web app URL | `https://networxradio.com` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase analytics (optional) | From Firebase Console |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Server-side: full JSON of service account | From Firebase Console (Generate key) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://tgjydsqeatvcerzpdqup.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | From Supabase Dashboard → API |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | From Stripe Dashboard |

Redeploy the Vercel project after adding or changing variables.
