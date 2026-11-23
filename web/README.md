# NETWORX Web App

Next.js App Router frontend for NETWORX Radio (https://www.networxradio.com) and Pro-Networx (https://www.pro-networx.com): marketing pages, the signed-in Radio dashboard, Pro-Networx, and web admin tools. One deployment serves both domains; `src/middleware.ts` routes by host.

## Stack

- Next.js 16 (`next@16.1.4`), Turbopack in dev, webpack for production builds
- React 19.2
- Tailwind CSS v4 + shadcn/ui
- Firebase Auth (client) + Firebase Admin (API routes)
- Axios client with Firebase bearer-token interceptor
- Hls.js for radio playback
- Supabase JS (Realtime)
- Stripe Checkout for web payments
- PWA (`@ducanh2912/next-pwa`) with offline fallback at `/~offline`

## API and auth model

- The browser calls same-origin `/api/*`. `next.config.ts` rewrites those requests to the NestJS backend at `BACKEND_URL` (falls back to `NEXT_PUBLIC_API_URL`, then `http://localhost:3000`).
- `/api/songs`, `/api/users`, `/api/discovery`, and `/api/analytics` are Next.js route handlers that proxy to the backend (multipart upload streaming). `/api/auth/login` and `/api/auth/logout` manage the session cookie.
- Large uploads go straight to the Railway backend host to avoid Vercel's request size limit.
- Firebase ID tokens are the primary API auth. The app also tries to mint an HTTP-only session cookie via `POST /api/auth/login`; if that fails locally, sign-in still works client-side.
- Signed-in users complete a phone text-code check before protected API calls succeed.
- Guests can browse public pages (radio, public artist and Pro profiles) and are asked to sign in when they act.
- Cross-domain sign-in between the two domains uses `/auth-handoff` and `/cross-domain-login`.

## Feature areas

- **Marketing** (`(marketing)`): home, about, features, pricing, FAQ, contact, Legal Center and policy pages, public artist pages (`/artists/:id`, `/open/artists/:id` with "Open in the NetworX app"), song and station pages
- **Auth** (`(auth)`): login, signup
- **Radio dashboard** (`(dashboard)`):
  - listen / radio player (votes, ratings, Live Chat + song Comments, clips), Pro-Radio playlists
  - discover (swipe, create video, artist search), browse, liked / saved, competition
  - messages, notifications, room (The Chat Room), social
  - refinery, studios, performances, live / watch / go-live, stream settings, DJ
  - artist: songs, upload, buy placements, stats, payouts, services, live services
  - settings (notifications, playback, security, theme, blocked), help & legal, yield
  - admin: songs, users, queue, DJ booth, feed, swipe, lyrics, free rotation, fallback, streamers, reports, payouts
- **Pro-Networx** (`(ProNetworx)`, `/pro-networx/*`): home, directory, feed, explore, search, services, studios, jobs, beats, radio, onboarding, me, public profiles at `/pro-networx/u/:id`
- **App links**: `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`

Run `find src/app -name page.tsx` for the full route list.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set env in `web/.env.local`:

```env
BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...   # optional

FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}   # session cookies

NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Optional: `NEXT_PUBLIC_SITE_URL` (canonical origin, default `https://www.networxradio.com`), `NEXT_PUBLIC_PRO_NETWORX_APP_URL` (default `https://www.pro-networx.com`), `NEXT_PUBLIC_IOS_APP_URL` / `NEXT_PUBLIC_ANDROID_APP_URL` (store links), `ANDROID_APP_LINK_SHA256` (extra fingerprints for `assetlinks.json`). Production values: [`../docs/env-variables-setup.md`](../docs/env-variables-setup.md).

3. Run:

```bash
npm run dev
```

4. Open `http://localhost:3001`.

## Scripts

- `npm run dev` — dev server on port 3001
- `npm run build` — production build (`next build --webpack`)
- `npm run start`
- `npm run lint`
- `npm run test:e2e` — Playwright smoke tests in `e2e/` (defaults to production; set `PLAYWRIGHT_BASE_URL` to test elsewhere)

## Key directories

```text
web/
  src/
    app/
      (marketing)/
      (auth)/
      (dashboard)/
      (ProNetworx)/
      api/
      .well-known/
    components/
    contexts/
    hooks/
    lib/
    middleware.ts
  e2e/
```

## Security notes

- Never commit new credentials; this private repo already tracks `web/.env.local`, so keep it confidential.
- Session cookies are HTTP-only when enabled.
- Bearer tokens are attached dynamically by the API client.
