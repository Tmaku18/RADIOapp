# NETWORX Web App

Next.js App Router frontend for marketing pages, authenticated dashboards, and admin tools.

## Stack

- Next.js 16 (`next@16.1.4`)
- React 19
- Tailwind CSS
- Firebase Auth (client) + Firebase Admin (API routes)
- Axios client with Firebase bearer-token interceptor
- Hls.js for radio playback
- Stripe Checkout for web payments

## Current auth model

Web auth uses Firebase ID tokens as the primary API auth mechanism.

- Client sign-in obtains Firebase ID token
- App attempts to create session cookie via `POST /api/auth/login`
- If session cookie minting fails locally, login still proceeds client-side
- Axios interceptor attaches bearer token to protected API calls

This gives resilient local behavior while still supporting SSR/session flows when configured.

## Feature areas

- Marketing site (`(marketing)`): landing, pricing, FAQ, contact, policy pages
- Auth (`(auth)`): login/signup, cross-domain/handoff flows
- Dashboard (`(dashboard)`):
  - listen/radio
  - discover + social discover
  - competition and voting
  - notifications and messages
  - stream settings + live/watch flows
  - artist pages (upload, songs, allocation, stats, services/live-services)
  - admin pages (moderation, streamers, swipe/tools)
- Pro-NETWORX surfaces (`(ProNetworx)`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `web/.env.local` (copy from `web/.env.local.example`), then set:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WEB_URL=http://localhost:3001

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

3. Run:

```bash
npm run dev
```

4. Open `http://localhost:3001`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

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
    components/
    contexts/
    lib/
```

## Security notes

- Never commit `.env.local` or credentials.
- Session cookies are HTTP-only when enabled.
- Bearer tokens are attached dynamically by the API client.
