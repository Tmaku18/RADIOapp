# Step-by-step: Backend (Railway) + Frontend (Vercel) + Domain (Namecheap)

Connect the RadioApp backend on Railway, web app on Vercel, and your domain on Namecheap. Use your **local env values** (from `backend/.env` and `web/.env.local`) to fill the variables below; use **MCPs when available** (Supabase, Firebase, Stripe) to fetch URLs/keys.

**Domain used in this guide:** `networxradio.com` (replace with yours if different).

---

## Part 1: Railway (backend)

### 1.1 Create/link project

1. Install Railway CLI: `npm install -g @railway/cli`
2. Log in: `railway login` (opens browser).
3. From repo root:
   - **New project:** In Cursor, use **Railway MCP** → **create-project-and-link** (projectName: `RadioApp`, workspacePath: repo root).  
   - **Existing project:** Run `railway link` and select project + environment.
4. Link backend service:
   - From terminal: `cd backend` then `railway link` → choose the **backend** service.  
   - Or use Railway MCP **link-service** with workspacePath = `backend` (or full path to `RadioApp/backend`).

### 1.2 Generate public URL

- Railway Dashboard → **RadioApp** → **backend** → **Settings** → **Networking** → **Generate domain**.  
- Or: `cd backend` then `railway domain` (CLI).  
- Note the URL, e.g. `https://backend-production-xxxx.up.railway.app` (no trailing slash). This is your **BACKEND_URL**.

### 1.3 Set root directory (if using GitHub deploy)

- Railway → **backend** → **Settings** → **Root Directory** = `backend` (so the Dockerfile in `backend/` is used).

### 1.4 Railway env variables (copy-paste block)

Copy the block below. Replace placeholders with values from your **local `backend/.env`** (or from Supabase/Stripe/Firebase). For **Supabase URL/keys**, you can use **Supabase MCP**: `get_project_url(project_id: "tgjydsqeatvcerzpdqup")` and `get_publishable_keys(project_id: "tgjydsqeatvcerzpdqup")` to get project URL and anon key; **service_role key** must be copied from Supabase Dashboard → Project Settings → API (never in MCP).

Paste into **Railway** → **backend** → **Variables** (or use Railway MCP **set-variables** with workspacePath = `backend`):

```env
NODE_ENV=production
PORT=3000
WEB_URL=https://networxradio.com
CORS_ORIGIN=https://networxradio.com,https://www.networxradio.com

FIREBASE_PROJECT_ID=<from backend/.env or Firebase Console>
FIREBASE_CLIENT_EMAIL=<from backend/.env - Firebase service account>
FIREBASE_PRIVATE_KEY=<from backend/.env - use Dashboard for multi-line>

SUPABASE_URL=https://tgjydsqeatvcerzpdqup.supabase.co
SUPABASE_SERVICE_KEY=<from backend/.env or Supabase Dashboard → API → service_role>

STRIPE_SECRET_KEY=<from backend/.env>
STRIPE_WEBHOOK_SECRET=<from Stripe Webhook - set after Part 4>
STRIPE_CREATOR_NETWORK_PRICE_ID=<from backend/.env>

REDIS_URL=<from backend/.env or Railway Redis plugin>

SENTRY_DSN=<optional - from backend/.env>
ADMIN_EMAILS=<optional - comma-separated emails>
THRESHOLD_ENTER_PAID=5
THRESHOLD_EXIT_PAID=3
CHECKPOINT_INTERVAL=5
```

- **FIREBASE_PRIVATE_KEY:** If it has newlines, set it in Railway Dashboard (Variables) instead of CLI/MCP to avoid escaping issues.
- **REDIS_URL:** Add a Redis plugin in Railway or use an external URL (e.g. Upstash); copy the URL into `REDIS_URL`.

### 1.5 Deploy backend

- Push to your connected branch, or run `cd backend` then `railway up`.  
- After deploy, confirm the generated domain returns e.g. `GET /api/radio/current` (or any public route).

---

## Part 2: Vercel (web app)

### 2.1 Import/link project

1. Go to [Vercel](https://vercel.com) → **Add New** → **Project**.
2. Import the repo (e.g. GitHub **Tmaku18/RADIOapp** or your fork).
3. Set **Root Directory** to `web` (so the Next.js app in `web/` is built).
4. Do **not** add the domain yet; we’ll add it after Namecheap DNS.

### 2.2 Vercel env variables (copy-paste block)

Copy the block below. Replace placeholders with values from your **local `web/.env.local`**. For **Supabase**: use **Supabase MCP** `get_project_url` and `get_publishable_keys` with project_id `tgjydsqeatvcerzpdqup` for URL and anon key if you prefer.

Paste into **Vercel** → **radi-oapp** (or your project) → **Settings** → **Environment Variables**. Add for **Production** (and **Preview** if you want):

```env
BACKEND_URL=https://backend-production-xxxx.up.railway.app
NEXT_PUBLIC_API_URL=https://backend-production-xxxx.up.railway.app
NEXT_PUBLIC_WEB_URL=https://networxradio.com

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

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<from web/.env.local>
```

- Replace `https://backend-production-xxxx.up.railway.app` with your **actual Railway backend URL** from Part 1.2 (no trailing slash).

### 2.3 Deploy

- Save env vars and trigger a deploy (push to branch or **Redeploy** in Vercel). The app will work on the default `*.vercel.app` URL first; we’ll attach the custom domain next.

---

## Part 3: Namecheap DNS → Vercel

### 3.1 Add domain in Vercel

1. Vercel → your project → **Settings** → **Domains**.
2. Click **Add** and add:
   - `networxradio.com`
   - `www.networxradio.com`
3. Vercel will show the **required DNS records** (e.g. A record for apex, CNAME for www). Leave this tab open.

### 3.2 Configure DNS in Namecheap

1. Log in to [Namecheap](https://www.namecheap.com) → **Domain List** → select **networxradio.com** → **Manage**.
2. Open **Advanced DNS**.
3. Add or update records as Vercel instructs. Typical setup:

   | Type  | Host | Value / Target                    | TTL  |
   |-------|------|-----------------------------------|------|
   | A     | @    | `76.76.21.21` (Vercel’s IP)       | Auto |
   | CNAME | www  | `cname.vercel-dns.com`            | Auto |

   (Vercel may show a different A record target; use the value Vercel shows in **Domains**.)

4. Remove any conflicting records (e.g. old A or CNAME for @ or www that point elsewhere).
5. Save. DNS can take 5–30 minutes to propagate.

### 3.3 (Optional) Redirect www ↔ apex in Vercel

- In Vercel **Domains**, set redirect: e.g. **www → apex** or **apex → www** so one canonical URL is used.

### 3.4 Verify

- When DNS has propagated, Vercel will show the domain as **Verified** and issue SSL.  
- Open `https://networxradio.com` and `https://www.networxradio.com` to confirm the app loads.

---

## Part 4: Firebase + Stripe (so sign-in and payments work)

### 4.1 Firebase authorized domains

1. [Firebase Console](https://console.firebase.google.com) → your project (e.g. **radioapp-4c14a**) → **Authentication** → **Settings** → **Authorized domains**.
2. Add:
   - `networxradio.com`
   - `www.networxradio.com`  
   (Without these, Google sign-in will show “unauthorized domain”.)

### 4.2 Stripe

- **Redirect URLs:** The app uses `NEXT_PUBLIC_WEB_URL` / `WEB_URL` for success/cancel; no change if both are `https://networxradio.com`.
- **Webhook:**  
  1. Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**.  
  2. URL: `https://<YOUR-RAILWAY-BACKEND-DOMAIN>/api/payments/webhook`  
     (e.g. `https://backend-production-xxxx.up.railway.app/api/payments/webhook`).  
  3. Select events you need (e.g. `checkout.session.completed`, payment events).  
  4. Copy the **Signing secret** (`whsec_...`) and set it in **Railway** as `STRIPE_WEBHOOK_SECRET` (and in `backend/.env` locally if you use it there).

---

## Part 5: Quick reference – where each variable lives

| Variable | Where to set | Where to copy from |
|---------|----------------|---------------------|
| **Railway (backend)** | Railway → backend → Variables | `backend/.env`; Supabase MCP for URL; Dashboard for service_role |
| **Vercel (web)**     | Vercel → project → Settings → Environment Variables | `web/.env.local`; Supabase MCP for URL/anon key |
| **BACKEND_URL**      | Vercel | Railway backend generated domain (Part 1.2) |
| **NEXT_PUBLIC_API_URL** | Vercel | Same as BACKEND_URL |
| **WEB_URL**          | Railway | `https://networxradio.com` |
| **CORS_ORIGIN**      | Railway | `https://networxradio.com,https://www.networxradio.com` |
| **NEXT_PUBLIC_WEB_URL** | Vercel | `https://networxradio.com` |

---

## Part 6: Optional – custom API domain (api.networxradio.com)

To avoid exposing the Railway hostname:

1. **Railway** → backend → **Settings** → **Networking** → add custom domain `api.networxradio.com`; note the CNAME target.
2. **Namecheap** → **Advanced DNS** → add **CNAME**: Host `api`, Value = Railway’s CNAME target.
3. **Vercel**: set `BACKEND_URL` and `NEXT_PUBLIC_API_URL` to `https://api.networxradio.com`.
4. **Railway**: set `STRIPE_WEBHOOK_SECRET`; in Stripe, set webhook URL to `https://api.networxradio.com/api/payments/webhook`.
5. After DNS propagates, the API is available at `https://api.networxradio.com`.

---

## Using MCPs

- **Supabase:** `get_project_url(project_id: "tgjydsqeatvcerzpdqup")` → use for `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`.  
  `get_publishable_keys(project_id: "tgjydsqeatvcerzpdqup")` → use the anon key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Service role key is only in Supabase Dashboard → API.
- **Railway:** If Railway MCP is available, use **set-variables** (workspacePath = `backend`, variables = `["KEY=value", ...]`) for non-secret vars; set secrets in Dashboard.
- **Stripe/Firebase:** No project MCP in this workspace for setting env vars; copy from local `.env` / Dashboard.

After this, everything is connected: Namecheap → Vercel (domain + SSL), Vercel → Railway (API via BACKEND_URL), and env variables aligned so sign-in and API calls work.
