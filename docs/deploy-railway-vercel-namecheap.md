# Step-by-step: Backend (Railway) + Frontend (Vercel) + Domain (Namecheap)

Connect the NetworX backend on Railway, the web app on Vercel, and the domains on Namecheap. Use your **local env values** (from `backend/.env` and `web/.env.local`) to fill the variables below; use **MCPs when available** (Supabase, Railway) to fetch URLs and IDs.

**Domains used in this guide:**

- `networxradio.com` / `www.networxradio.com` — NETWORX Radio
- `pro-networx.com` / `www.pro-networx.com` — Pro-Networx

Both products are served by the same Next.js app in `web/`. `web/src/middleware.ts` reads the request host and sends `pro-networx.com` visitors to the `/pro-networx` pages.

---

## Part 1: Railway (backend)

### 1.1 Create/link project

1. Install Railway CLI: `npm install -g @railway/cli`
2. Log in: `railway login` (opens browser).
3. From repo root:
   - **New project:** `railway init`, or create the project in the Railway Dashboard (or with Railway MCP **create-project**).
   - **Existing project:** run `railway link` and select project **RadioApp** + environment **production**.
4. Link the backend service: `cd backend` then `railway link` → choose the **backend** service.

### 1.2 Generate public URL

- Railway Dashboard → **RadioApp** → **backend** → **Settings** → **Networking** → **Generate domain**.
- Or: `cd backend` then `railway domain` (CLI), or Railway MCP **generate-domain**.
- Note the URL, e.g. `https://backend-production-xxxx.up.railway.app` (no trailing slash). This is your **BACKEND_URL**. Production today is `https://backend-production-17cc.up.railway.app`.

### 1.3 Set root directory (if using GitHub deploy)

- Railway → **backend** → **Settings** → **Root Directory** = `backend`, so Railway builds `backend/Dockerfile`.
- The Dockerfile uses **Node 22** (Supabase Realtime broadcasts need the native WebSocket global) and installs system **ffmpeg** for clip trims and lossless-to-MP3 transcodes. It starts `node dist/src/main.js` and exposes port 3000.

### 1.4 Railway env variables (copy-paste block)

Copy the block below. Replace placeholders with values from your **local `backend/.env`** (or from Supabase/Stripe/Firebase). For **Supabase URL/keys**, you can use **Supabase MCP**: `get_project_url(project_id: "tgjydsqeatvcerzpdqup")` and `get_publishable_keys(project_id: "tgjydsqeatvcerzpdqup")`; the **service_role key** must be copied from Supabase Dashboard → Project Settings → API (never in MCP).

Paste into **Railway** → **backend** → **Variables** (or use Railway MCP **set-variables**):

```env
NODE_ENV=production
PORT=3000
WEB_URL=https://www.networxradio.com
# Optional extra origins. The four production origins are always allowed in backend/src/main.ts.
CORS_ORIGIN=

FIREBASE_PROJECT_ID=<from backend/.env or Firebase Console>
FIREBASE_CLIENT_EMAIL=<from backend/.env - Firebase service account>
FIREBASE_PRIVATE_KEY=<from backend/.env - use Dashboard for multi-line>

SUPABASE_URL=https://tgjydsqeatvcerzpdqup.supabase.co
SUPABASE_SERVICE_KEY=<from backend/.env or Supabase Dashboard → API → service_role>
DATABASE_URL=<optional - Supabase transaction pooler URL, port 6543>

STRIPE_SECRET_KEY=<from backend/.env>
STRIPE_PUBLISHABLE_KEY=<from backend/.env>
STRIPE_WEBHOOK_SECRET=<from Stripe Webhook - set after Part 4>
STRIPE_CREATOR_NETWORK_PRICE_ID=<from backend/.env>
STRIPE_PRO_NETWORX_PRICE_ID=<from backend/.env>
STRIPE_PRO_NETWORX_INTRO_COUPON_ID=<from backend/.env>
STRIPE_PRO_RADIO_PRICE_ID=<from backend/.env>
STRIPE_PRO_RADIO_INTRO_COUPON_ID=<from backend/.env>
STRIPE_PRO_BUNDLE_PRICE_ID=<from backend/.env>

REDIS_URL=<Railway Redis service URL>

TWILIO_ACCOUNT_SID=<from Twilio>
TWILIO_AUTH_TOKEN=<from Twilio>
TWILIO_FROM_NUMBER=<from Twilio>

BETA_ALL_FREE=false
SENTRY_DSN=<optional - from backend/.env>
ADMIN_EMAILS=<optional - comma-separated emails>
THRESHOLD_ENTER_PAID=5
THRESHOLD_EXIT_PAID=3
CHECKPOINT_INTERVAL=5
```

- **FIREBASE_PRIVATE_KEY:** If it has newlines, set it in Railway Dashboard (Variables) instead of CLI/MCP to avoid escaping issues.
- **REDIS_URL:** The RadioApp project has a **Redis** service. Redis holds shared radio state and the BullMQ push queue.
- **TWILIO_\*:** Sends the sign-in text code. In production, phone verification is enforced only when all three are set.
- **App Store / Google Play billing, email, R2 storage, ACRCloud, ElevenLabs, Cloud Vision, Cloudflare Stream:** see the full list in [railway-setup.md](railway-setup.md) and `backend/.env.example`.

### 1.5 Deploy backend

- Push to your connected branch, or run `cd backend` then `railway up`.
- After deploy, confirm `GET https://<backend-domain>/api/health` returns `{ "status": "ok", ... }` (it returns **503** with `"status": "degraded"` when Supabase does not answer).

---

## Part 2: Vercel (web app)

### 2.1 Import/link project

1. Go to [Vercel](https://vercel.com) → **Add New** → **Project**.
2. Import the repo (e.g. GitHub **Tmaku18/RADIOapp** or your fork).
3. Set **Root Directory** to `web` (so the Next.js app in `web/` is built). `npm run build` runs `next build --webpack`.
4. Do **not** add the domains yet; add them after Namecheap DNS.

### 2.1a Build-minute controls (recommended)

To avoid unnecessary Vercel build minutes in this monorepo:

1. Keep each Vercel project pointed at its app root:
   - `web` project → Root Directory `web`
   - `admin` project → Root Directory `admin`
2. Keep app-local `vercel.json` checked in (`web/vercel.json`, `admin/vercel.json`).
   - Each file uses `ignoreCommand` so Vercel skips builds when that app folder did not change.
3. Keep dependency updates app-local:
   - If you change `web/package.json`, commit `web/package-lock.json` in the same PR.
   - If you change `admin/package.json`, commit `admin/package-lock.json` in the same PR.
4. Avoid noisy preview churn:
   - Batch small docs/notes commits locally when possible.
   - Push when preview validation is needed.
   - Use Vercel **Redeploy** for manual preview refreshes instead of creating extra commits.

### 2.2 Vercel env variables (copy-paste block)

Copy the block below. Replace placeholders with values from your **local `web/.env.local`**. For **Supabase**: use **Supabase MCP** `get_project_url` and `get_publishable_keys` with project_id `tgjydsqeatvcerzpdqup` for URL and anon key if you prefer.

Paste into **Vercel** → **radi-oapp** (or your project) → **Settings** → **Environment Variables**. Add for **Production** (and **Preview** if you want):

```env
BACKEND_URL=https://backend-production-xxxx.up.railway.app
NEXT_PUBLIC_API_URL=https://backend-production-xxxx.up.railway.app

NEXT_PUBLIC_FIREBASE_API_KEY=<from web/.env.local>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<from web/.env.local>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<from web/.env.local>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<from web/.env.local>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from web/.env.local>
NEXT_PUBLIC_FIREBASE_APP_ID=<from web/.env.local>
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=<from web/.env.local>

FIREBASE_SERVICE_ACCOUNT_KEY=<from web/.env.local - full JSON string>

NEXT_PUBLIC_SUPABASE_URL=https://tgjydsqeatvcerzpdqup.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from web/.env.local or Supabase MCP get_publishable_keys>

# Android App Links: SHA-256 of the Play App Signing cert (Play Console → App integrity). Comma-separate several.
ANDROID_APP_LINK_SHA256=<from Play Console>

# Optional. Defaults shown.
# NEXT_PUBLIC_SITE_URL=https://www.networxradio.com
# NEXT_PUBLIC_PRO_NETWORX_APP_URL=https://www.pro-networx.com
# NEXT_PUBLIC_IOS_APP_URL=<App Store listing URL>
# NEXT_PUBLIC_ANDROID_APP_URL=<Play Store listing URL>
```

- Replace `https://backend-production-xxxx.up.railway.app` with your **actual Railway backend URL** from Part 1.2 (no trailing slash).
- `web/next.config.ts` rewrites `/api/*` to `BACKEND_URL` (falls back to `NEXT_PUBLIC_API_URL`). `/api/songs`, `/api/users`, `/api/discovery`, and `/api/analytics` are proxied by App Route handlers in `web/src/app/api/` that read `BACKEND_URL` at runtime (`web/src/lib/backend-url.ts`, with the production Railway host as the last fallback). `/api/auth/login` and `/api/auth/logout` manage the session cookie in Next.js with `FIREBASE_SERVICE_ACCOUNT_KEY`; `/api/auth/cross-domain-exchange` (Radio ↔ Pro-Networx sign-in handoff) calls the backend.

### 2.3 Deploy

- Save env vars and trigger a deploy (push to branch or **Redeploy** in Vercel). The app works on the default `*.vercel.app` URL first; attach the custom domains next.

---

## Part 3: Namecheap DNS → Vercel

### 3.1 Add domains in Vercel

1. Vercel → your project → **Settings** → **Domains**.
2. Click **Add** and add:
   - `networxradio.com`
   - `www.networxradio.com`
   - `pro-networx.com`
   - `www.pro-networx.com`
3. Vercel shows the **required DNS records** (A record for each apex, CNAME for each www). Leave this tab open.

### 3.2 Configure DNS in Namecheap

1. Log in to [Namecheap](https://www.namecheap.com) → **Domain List** → select the domain → **Manage**.
2. Open **Advanced DNS**.
3. Add or update records exactly as Vercel instructs. Typical setup:

   | Type  | Host | Value / Target                     | TTL  |
   |-------|------|------------------------------------|------|
   | A     | @    | Apex IP shown in Vercel **Domains** | Auto |
   | CNAME | www  | CNAME target shown in Vercel        | Auto |

   Vercel's apex IP and CNAME target can change between projects; always copy them from **Domains**.

4. Remove any conflicting records (e.g. old A or CNAME for @ or www that point elsewhere).
5. Repeat for `pro-networx.com`. Save. DNS can take 5–30 minutes to propagate.

### 3.3 Redirect apex → www in Vercel

- In Vercel **Domains**, redirect each apex to its www host. Production uses **www** as the canonical host: `networxradio.com` → `www.networxradio.com`, `pro-networx.com` → `www.pro-networx.com`.
- On `www.pro-networx.com`, `/` then redirects to `/pro-networx` (middleware).

### 3.4 Verify

- When DNS has propagated, Vercel shows each domain as **Verified** and issues SSL.
- Open `https://www.networxradio.com` and `https://www.pro-networx.com` to confirm the app loads.
- `https://www.networxradio.com/api/health` should return the same JSON as the Railway health URL (proves the `/api` rewrite works).

---

## Part 4: Firebase, Stripe, and app links

### 4.1 Firebase authorized domains

1. [Firebase Console](https://console.firebase.google.com) → project **radioapp-4c14a** → **Authentication** → **Settings** → **Authorized domains**.
2. Add `networxradio.com`, `www.networxradio.com`, `pro-networx.com`, and `www.pro-networx.com`. Without these, Google sign-in shows "unauthorized domain". See [firebase-authorized-domains.md](firebase-authorized-domains.md).

### 4.2 Stripe

- **Redirect URLs:** The backend builds default success/cancel URLs from `WEB_URL`; the web app usually passes its own `successUrl` / `cancelUrl`.
- **Webhook:**
  1. Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**.
  2. URL: `https://<YOUR-RAILWAY-BACKEND-DOMAIN>/api/payments/webhook`
     (e.g. `https://backend-production-xxxx.up.railway.app/api/payments/webhook`).
  3. Select the events the handler in `backend/src/payments/payments.controller.ts` processes:
     - `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
     - `payment_intent.succeeded`, `payment_intent.payment_failed`
     - `customer.subscription.updated`, `customer.subscription.deleted`
     - `setup_intent.succeeded`
     - `account.updated` (Stripe Connect payouts)
  4. Copy the **Signing secret** (`whsec_...`) and set it in **Railway** as `STRIPE_WEBHOOK_SECRET` (and in `backend/.env` locally if you use it there).
- **Store billing notifications** (iOS and Android purchases do not use Stripe):
  - App Store Server Notifications V2 → `https://<backend>/api/payments/app-store/notifications`
  - Google Play real-time developer notifications (Pub/Sub push) → `https://<backend>/api/payments/google-play/rtdn`

### 4.3 App links (iOS Universal Links + Android App Links)

The web app serves both association files from route handlers:

- `web/src/app/.well-known/apple-app-site-association/route.ts` — app ID `8QZ4S3G53V.com.tmaktechnologies.networxradio`; paths `/artists/*`, `/artist/*`, `/song/*`, `/songs/*`, `/radio/*`, and the same under `/open/`.
- `web/src/app/.well-known/assetlinks.json/route.ts` — package `com.tmaktechnologies.networxradio`; fingerprints come from `ANDROID_APP_LINK_SHA256`.

Check both after each deploy:

```bash
curl -s https://www.networxradio.com/.well-known/apple-app-site-association
curl -s https://www.networxradio.com/.well-known/assetlinks.json
```

`sha256_cert_fingerprints` must be non-empty, or Android opens shared links in the browser.

---

## Part 5: Quick reference – where each variable lives

| Variable | Where to set | Where to copy from |
|---------|----------------|---------------------|
| **Railway (backend)** | Railway → backend → Variables | `backend/.env`; Supabase MCP for URL; Dashboard for service_role |
| **Vercel (web)**     | Vercel → project → Settings → Environment Variables | `web/.env.local`; Supabase MCP for URL/anon key |
| **BACKEND_URL**      | Vercel | Railway backend generated domain (Part 1.2) |
| **NEXT_PUBLIC_API_URL** | Vercel | Same as BACKEND_URL |
| **ANDROID_APP_LINK_SHA256** | Vercel | Play Console → App integrity |
| **WEB_URL**          | Railway | `https://www.networxradio.com` |
| **CORS_ORIGIN**      | Railway | Only extra origins; production origins are built in |

---

## Part 6: Optional – custom API domain (api.networxradio.com)

To avoid exposing the Railway hostname:

1. **Railway** → backend → **Settings** → **Networking** → add custom domain `api.networxradio.com`; note the CNAME target.
2. **Namecheap** → **Advanced DNS** → add **CNAME**: Host `api`, Value = Railway's CNAME target.
3. **Vercel**: set `BACKEND_URL` and `NEXT_PUBLIC_API_URL` to `https://api.networxradio.com`.
4. **Stripe**: set the webhook URL to `https://api.networxradio.com/api/payments/webhook`. Update the App Store and Google Play notification URLs the same way.
5. After DNS propagates, the API is available at `https://api.networxradio.com`.

The mobile app calls the Railway backend directly first and falls back to the website, so a Vercel outage does not take the app down. If you move the API host, update the mobile `API_DIRECT_URL` / `BACKEND_URL` values too.

---

## Using MCPs

- **Supabase:** `get_project_url(project_id: "tgjydsqeatvcerzpdqup")` → use for `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`.
  `get_publishable_keys(project_id: "tgjydsqeatvcerzpdqup")` → use the anon key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Service role key is only in Supabase Dashboard → API.
- **Railway:** Railway MCP **set-variables** for non-secret vars, **list-domains** / **domain-status** for domains, **list-deployments** / **get-logs** for deploys. Set secrets in the Dashboard.
- **Stripe/Firebase:** No project MCP in this workspace for setting env vars; copy from local `.env` / Dashboard.

After this, everything is connected: Namecheap → Vercel (domains + SSL), Vercel → Railway (API via BACKEND_URL), and env variables aligned so sign-in, payments, and app links work.
