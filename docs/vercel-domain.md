# Vercel domain: networxradio.com

**Full production checklist:** See [production-networxradio.md](production-networxradio.md) for the complete networxradio.com setup (DNS, Vercel, Railway, Firebase, Stripe).

The main web app (in `web/`) is linked to the Vercel project **radi-oapp**. Production runs on **networxradio.com** and **www.networxradio.com** (both required).

## Add the domain in Vercel

1. Open [Vercel Dashboard](https://vercel.com) → **DiscoverMe Radio Group LLC** → project **radi-oapp**.
2. Go to **Settings** → **Domains**.
3. Click **Add** and add both (required):
   - `networxradio.com`
   - `www.networxradio.com`
4. Configure redirect in Vercel if desired (e.g. www to apex or apex to www).
5. Follow Vercel’s DNS instructions: add the A/CNAME records at your registrar (where networxradio.com is registered) as shown in the Dashboard.

## Environment variables

Set these so the app and backend use the correct URLs:

- **Vercel (radi-oapp project)**  
  - `NEXT_PUBLIC_WEB_URL` = `https://networxradio.com`  
  - `BACKEND_URL` = your Railway backend URL (no trailing slash). Get it with `railway domain` in the repo; current value is **`https://backend-production-17cc.up.railway.app`**. Required for sign-up/role-select (POST /api/users) to work; otherwise you get 404.

- **Backend (e.g. Railway)**  
  - `WEB_URL` = `https://networxradio.com`  
  - `CORS_ORIGIN` = `https://networxradio.com,https://www.networxradio.com` (both required).

After DNS propagates, the site will be served at **https://networxradio.com** and **https://www.networxradio.com**.

## Build-minute optimization policy

This repo has three Next.js apps (`web`, `pro-web`, `admin`) and each should have its own Vercel project with matching Root Directory.

- `web` -> `web`
- `pro-web` -> `pro-web`
- `admin` -> `admin`

Each app now has a local `vercel.json` ignore command that skips builds when files in that app root were not changed in the commit.

### Verification matrix (post-change)

Use this matrix in Vercel Deployments to confirm skip behavior:

1. Commit touching only `docs/**` -> all three projects should be **Skipped**.
2. Commit touching only `web/**` -> `web` builds, `pro-web` and `admin` skip.
3. Commit touching only `pro-web/**` -> `pro-web` builds, `web` and `admin` skip.
4. Commit touching only `admin/**` -> `admin` builds, `web` and `pro-web` skip.

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
