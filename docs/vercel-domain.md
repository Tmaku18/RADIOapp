# Vercel domains: networxradio.com + pro-networx.com

**Full production checklist:** See [production-networxradio.md](production-networxradio.md) for the complete setup (DNS, Vercel, Railway, Firebase, Stripe, app links).

The main web app (in `web/`) is linked to the Vercel project **radi-oapp**. The same project serves both products:

- NETWORX Radio: **www.networxradio.com** (apex `networxradio.com` redirects to www)
- Pro-Networx: **www.pro-networx.com** (apex `pro-networx.com` redirects to www)

`web/src/middleware.ts` checks the host: on `pro-networx.com` / `www.pro-networx.com`, `/` redirects to `/pro-networx`.

## Add the domains in Vercel

1. Open [Vercel Dashboard](https://vercel.com) → **DiscoverMe Radio Group LLC** → project **radi-oapp**.
2. Go to **Settings** → **Domains**.
3. Click **Add** and add all four:
   - `networxradio.com`
   - `www.networxradio.com`
   - `pro-networx.com`
   - `www.pro-networx.com`
4. Set each apex to redirect to its www host.
5. Follow Vercel's DNS instructions: add the A/CNAME records at your registrar as shown in the Dashboard.

## Environment variables

Set these so the app and backend use the correct URLs:

- **Vercel (radi-oapp project)**
  - `BACKEND_URL` = your Railway backend URL (no trailing slash). Current value is **`https://backend-production-17cc.up.railway.app`**. `web/next.config.ts` rewrites `/api/*` to this host, and the `/api/songs`, `/api/users`, `/api/discovery`, and `/api/analytics` route handlers proxy to it.
  - `NEXT_PUBLIC_API_URL` = same as `BACKEND_URL`.
  - `ANDROID_APP_LINK_SHA256` = Play App Signing SHA-256, for `/.well-known/assetlinks.json`.

- **Backend (Railway)**
  - `WEB_URL` = `https://www.networxradio.com`
  - `CORS_ORIGIN` = optional extras. Both apex and www origins for both domains are always allowed in `backend/src/main.ts`.

After DNS propagates, the sites are served at **https://www.networxradio.com** and **https://www.pro-networx.com**.

## Build-minute optimization policy

This repo has two Next.js apps (`web`, `admin`) and each should have its own Vercel project with matching Root Directory.

- `web` -> `web`
- `admin` -> `admin`

Each app has a local `vercel.json` ignore command that skips builds when files in that app root were not changed in the commit:

```json
"ignoreCommand": "if git rev-parse HEAD^ > /dev/null 2>&1; then git diff --quiet HEAD^ HEAD -- .; test $? -eq 0; else exit 1; fi"
```

### Verification matrix (post-change)

Use this matrix in Vercel Deployments to confirm skip behavior:

1. Commit touching only `docs/**` -> both projects should be **Skipped**.
2. Commit touching only `web/**` -> `web` builds, `admin` skips.
3. Commit touching only `admin/**` -> `admin` builds, `web` skips.

Track build count/build minutes for one week before and after applying these rules.

### Baseline snapshot (before this optimization)

Snapshot date: 2026-03-29 (from Vercel project `radi-oapp`, team `DiscoverMe Radio Group LLC`).

- Recent deployments sampled: 20
- Production-target deployments in sample: 20
- Docs-only commit observed triggering a production build:
  - Commit `fdf992ac64e85cf6d06b8b647bf07419604699ef`
  - Message: `Docs: align README, API, schema, UML with temperature and leaderboards (047-049)`
  - Deployment state: `READY`

This confirms minute spend was occurring for non-site-impacting documentation commits before `ignoreCommand` rules were added.

### After-rollout tracking (fill after next week)

- Compare `build count` and `build minutes` for 7 days after merge.
- Expected result: docs-only and unrelated-folder commits are marked **Skipped** for app projects.

## Firebase "Unauthorized domain" on sign-in

If Google (or other) sign-in fails with **unauthorized domain**, add your app domains in Firebase: **Authentication → Settings → Authorized domains**. See [firebase-authorized-domains.md](./firebase-authorized-domains.md) for the exact list and steps.
