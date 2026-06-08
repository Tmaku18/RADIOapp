# Pivot staging — isolate `pivot/radioapp-monolith` from production

Branch: **`pivot/radioapp-monolith`**

Related: [PIVOT_CUTOVER.md](PIVOT_CUTOVER.md) (cutover checklist), [MONOREPO.md](MONOREPO.md) (layout), [production-networxradio.md](production-networxradio.md) (live prod).

---

## Goal

Run the infrastructure pivot on a **separate stack** so **`main` / networxradio.com keep working** until you deliberately cut over.

**Git branches do not affect each other until merge.** The real risk is **shared production services** (Supabase, Railway, Stripe webhooks, Redis).

```text
┌─────────────────────────────────────────────────────────────────┐
│ PRODUCTION (main) — do not change for pivot experiments         │
│  Vercel Production → networxradio.com                           │
│  Railway backend-production → NestJS                            │
│  Supabase tgjydsqeatvcerzpdqup (prod DB)                        │
│  Stripe live mode + prod webhook                                │
│  Redis (live radio state)                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PIVOT STAGING (pivot/radioapp-monolith)                         │
│  Vercel Preview (or radi-oapp-pivot project)                    │
│  Railway backend-pivot-staging → NestJS clone OR shared read    │
│  Supabase branch / staging project                              │
│  Stripe test mode + staging webhook                             │
│  Redis staging (separate instance)                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ LOCAL (your machine)                                            │
│  npm run dev → http://localhost:3001                            │
│  web/.env.local → points at STAGING services (not prod)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Golden rules

1. **Vercel Production branch = `main` only.** Never promote a pivot preview to Production.
2. **Never apply pivot migrations (`087`–`089`) to production Supabase** until Phase 7 cutover.
3. **Pivot Preview / local `BACKEND_URL` → staging Railway**, not `backend-production-17cc...`.
4. **Keep `STRANGLER_LOCAL_MODULES` minimal** on staging (`health` only) until a module passes parity tests.
5. **Stripe test keys** on Preview/local; **separate webhook** URL for staging backend.
6. **Separate Redis** for pivot radio worker — production Redis drives live radio.
7. **Do not merge** `pivot/radioapp-monolith` → `main` until [PIVOT_CUTOVER.md](PIVOT_CUTOVER.md) is green.

---

## Option A — Recommended (Preview + staging services)

Use the existing **radi-oapp** Vercel project; pivot branch gets **Preview** deploys only.

### A1. Vercel

**Dashboard:** [Vercel](https://vercel.com) → **DiscoverMe Radio Group LLC** → **radi-oapp**

| Setting | Production (`main`) | Preview (`pivot/radioapp-monolith`) |
|--------|-------------------|-----------------------------------|
| **Production Branch** | `main` | *(never set pivot as Production)* |
| **Root Directory** | `web` | `web` |
| **Domains** | `networxradio.com`, `www.networxradio.com` | `*.vercel.app` preview URL only |
| **Env scope** | **Production** env vars | **Preview** env vars (separate table below) |

Steps:

1. **Settings → Git → Production Branch** → confirm **`main`**.
2. Push to `pivot/radioapp-monolith` → Vercel builds a **Preview** URL (e.g. `radi-oapp-git-pivot-radioapp-monolith-….vercel.app`).
3. Add Preview-only env vars (**Settings → Environment Variables** → check **Preview**, uncheck Production).
4. Add the **exact preview hostname** to Firebase Authorized domains ([firebase-authorized-domains.md](firebase-authorized-domains.md)) if you need sign-in on Preview.

`web/vercel.json` already forces `npm install` + `npm run build` (required for the monorepo pivot layout).

### A2. Railway — staging backend clone

**Dashboard:** [Railway](https://railway.app) → **RadioApp**

1. **Duplicate** the `backend` service → name it **`backend-pivot-staging`**.
2. **Settings → Source** → deploy from branch `pivot/radioapp-monolith` (or `main` backend code initially — same NestJS is fine).
3. **Settings → Root Directory** → `backend`.
4. **Networking → Generate domain** → note URL, e.g. `https://backend-pivot-staging-xxxx.up.railway.app`.
5. Set **staging variables** (copy from production, then change what’s listed below):

| Variable | Staging value |
|----------|----------------|
| `WEB_URL` | Your Vercel **Preview** URL (not networxradio.com) |
| `CORS_ORIGIN` | Preview URL + `http://localhost:3001` |
| `SUPABASE_URL` | Staging Supabase URL (branch or staging project) |
| `SUPABASE_SERVICE_KEY` | Staging service role key |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | From **test** webhook pointing at staging backend |
| `REDIS_URL` | **New** Redis plugin (staging), not production Redis |
| `NODE_ENV` | `production` (Railway runtime; still “staging” logically) |

6. Deploy and smoke-test: `GET https://<staging-host>/api/health` (or `/api/radio/current`).

**Optional:** duplicate `workers/radio` as `radio-worker-staging` with staging `REDIS_URL`.

### A3. Supabase — staging database

Production project: **`tgjydsqeatvcerzpdqup`** (RADIOapp). **Do not run pivot migrations there yet.**

Pick one:

| Approach | When to use | How |
|----------|-------------|-----|
| **Supabase branch** | Pro plan; want prod-like schema fork | Dashboard → **Branches** → create branch (e.g. `pivot-staging`). Apply `087`–`089` on the branch only. |
| **Separate project** | Maximum isolation | Create `RADIOapp-staging` project; run all migrations from scratch or restore snapshot. |

Apply pivot migrations **only** on staging:

```bash
# From repo root — target STAGING, not production
# Prefer Supabase MCP apply_migration or CLI linked to staging project
backend/supabase/migrations/087_supabase_auth_user_link.sql
backend/supabase/migrations/088_comprehensive_rls_pivot.sql
backend/supabase/migrations/089_privileged_rpcs_pivot.sql
```

Verify RLS on staging: `pnpm test:rls` (with staging `SUPABASE_URL` / service key).

Docs: [Supabase branching](https://supabase.com/docs/guides/deployment/branching), [managing environments](https://supabase.com/docs/guides/deployment/managing-environments).

---

## Option B — Stronger isolation (second Vercel project)

Create **`radi-oapp-pivot`** in Vercel:

1. Import same GitHub repo.
2. **Root Directory** = `web`.
3. **Production Branch** = `pivot/radioapp-monolith` (this project’s “prod” is pivot-only).
4. Use a subdomain later (e.g. `staging.networxradio.com`) — **never** point apex/www here until cutover.

Useful when you want pivot previews without touching radi-oapp Production settings at all.

---

## Environment variable reference

Copy **`web/.env.pivot.example`** → **`web/.env.local`** for local dev.

### Production — Vercel **Production** scope (`main` → networxradio.com)

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_WEB_URL` | `https://networxradio.com` |
| `BACKEND_URL` | `https://backend-production-17cc.up.railway.app` (or custom API domain) |
| `NEXT_PUBLIC_API_URL` | Same as `BACKEND_URL` |
| `STRANGLER_ENABLED` | **`false`** (or unset) on prod until cutover |
| `NEXT_PUBLIC_AUTH_PRIMARY` | `firebase` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tgjydsqeatvcerzpdqup.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod anon key |
| Firebase `NEXT_PUBLIC_FIREBASE_*` | Prod web config |
| Stripe | **Live** publishable key |

### Pivot Preview — Vercel **Preview** scope only

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_WEB_URL` | `https://<your-preview-host>.vercel.app` |
| `BACKEND_URL` | `https://backend-pivot-staging-xxxx.up.railway.app` |
| `NEXT_PUBLIC_API_URL` | Same as staging `BACKEND_URL` |
| `STRANGLER_ENABLED` | `true` |
| `STRANGLER_LOCAL_MODULES` | `health` (expand after parity tests) |
| `PAYMENTS_WEBHOOK_DELEGATE_LEGACY` | `true` (webhook stays on staging NestJS until ready) |
| `NEXT_PUBLIC_AUTH_PRIMARY` | `firebase` (until Supabase auth soak on staging) |
| `AUTH_FIREBASE_FALLBACK` | `true` |
| `NEXT_PUBLIC_SUPABASE_URL` | **Staging** Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key |
| `SUPABASE_URL` | Staging URL (server) |
| `SUPABASE_SERVICE_KEY` | Staging service role |
| Firebase `NEXT_PUBLIC_FIREBASE_*` | Same prod Firebase project is OK; add preview domain |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |
| `MONOLITH_ADMIN_ENABLED` | `false` |
| `MONOLITH_PRO_ENABLED` | `false` |
| `RADIO_WORKER_URL` | Staging worker URL (when deployed) |

### Local — `web/.env.local`

Same as **Pivot Preview**, except:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_WEB_URL` | `http://localhost:3001` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` |
| `BACKEND_URL` | Staging Railway URL (**not** production) |
| `REDIS_URL` | `redis://localhost:6379` (if running worker locally) |

**Important:** If your local `.env.local` still points `BACKEND_URL` at production Railway, browsing is fine but **strangler local modules must stay minimal** to avoid writing to prod data.

---

## Stripe isolation

| Environment | Secret key | Webhook endpoint |
|-------------|------------|------------------|
| Production | Live `sk_live_...` | `https://<prod-backend>/api/payments/webhook` |
| Pivot staging | Test `sk_test_...` | `https://<staging-backend>/api/payments/webhook` |

In Stripe Dashboard → **Developers → Webhooks**:

- Keep **production** endpoint unchanged.
- Add a **test mode** endpoint for staging backend only.

On pivot Preview, set `PAYMENTS_WEBHOOK_DELEGATE_LEGACY=true` so Next.js does not intercept webhooks until parity is proven.

---

## Firebase

- **Same project** (`radioapp-4c14a`) is fine for staging while auth is Firebase-first.
- Add each **exact** Preview hostname to [Authorized domains](firebase-authorized-domains.md) (no wildcards).
- `localhost` is already allowed for local dev.

When you flip staging to `NEXT_PUBLIC_AUTH_PRIMARY=supabase`, configure OAuth providers on **staging Supabase only**.

---

## Step-by-step checklist (first-time setup)

### Phase 0 — Lock production

- [ ] Vercel **Production Branch** = `main`
- [ ] Confirm production env vars unchanged on **Production** scope
- [ ] Document prod Railway URL (`backend-production-17cc...`)

### Phase 1 — Staging backend

- [ ] Create Railway `backend-pivot-staging` + staging Redis
- [ ] Point staging at staging Supabase keys
- [ ] Stripe test keys + test webhook → staging backend
- [ ] Smoke-test staging API health

### Phase 2 — Staging database

- [ ] Create Supabase branch or staging project
- [ ] Apply migrations `087`–`089` on **staging only**
- [ ] Run `pnpm test:rls` against staging

### Phase 3 — Pivot Preview

- [ ] Set Vercel **Preview** env vars (table above)
- [ ] Push `pivot/radioapp-monolith` → open Preview URL
- [ ] Add Preview hostname to Firebase Authorized domains
- [ ] Sign in + one API flow (listen, profile, upload) on Preview

### Phase 4 — Local

- [ ] Copy `web/.env.pivot.example` → `web/.env.local`
- [ ] Fill staging URLs/keys (not production)
- [ ] `cd web && npm install && npm run dev`
- [ ] Open http://localhost:3001

### Phase 5 — Expand strangler (when ready)

- [ ] Parity test one module → add to `STRANGLER_LOCAL_MODULES`
- [ ] Repeat until [PIVOT_CUTOVER.md](PIVOT_CUTOVER.md) Phase 7

---

## What can still break production (avoid these)

| Action | Risk |
|--------|------|
| Apply `087`–`089` on prod Supabase | Breaks RLS/auth for live users |
| Point pivot Preview `BACKEND_URL` at prod + enable local `auth,users,payments` | Pivot code writes to prod DB |
| Change Vercel **Production** env vars | Breaks networxradio.com |
| Point prod Stripe webhook at pivot Next.js | Payment processing breaks |
| Pivot worker using prod `REDIS_URL` | Corrupts live radio state |
| Merge pivot → `main` before cutover checklist | Ships incomplete pivot to prod |

---

## Rollback

**Production unaffected by pivot staging** — rollback is “stop using staging”:

1. Stay on / redeploy **`main`** on Vercel Production.
2. Ignore pivot Preview URL.
3. If prod was accidentally changed: restore env vars from [production-networxradio.md](production-networxradio.md) and redeploy.

If pivot code ever reaches Production by mistake:

1. Set `STRANGLER_ENABLED=false`
2. Set `NEXT_PUBLIC_AUTH_PRIMARY=firebase`
3. Redeploy last known-good `main` deployment in Vercel

See [PIVOT_CUTOVER.md — Rollback](PIVOT_CUTOVER.md#rollback).

---

## Quick reference — service URLs

| Service | Production | Pivot staging |
|---------|------------|---------------|
| Web | https://networxradio.com | Vercel Preview URL |
| NestJS API | `backend-production-17cc.up.railway.app` | `backend-pivot-staging-….up.railway.app` |
| Supabase | `tgjydsqeatvcerzpdqup.supabase.co` | Branch / staging project URL |
| Git branch | `main` | `pivot/radioapp-monolith` |

---

## Related files

| File | Purpose |
|------|---------|
| `web/.env.pivot.example` | Template for pivot/local env |
| `web/.env.local` | Your local secrets (gitignored) |
| `docs/env-variables-setup.md` | Full variable list |
| `docs/env-variables.local` | Optional gitignored copy-paste source |
