# NETWORX — Live Radio & Creator Network for Independent Artists

**By artists, for artists.**

NETWORX is a full-stack live radio platform and creator network built for underground and independent music. Artists upload tracks, buy discovery placements for them, and get real-time exposure in a shared radio experience, while **Prospectors** (listeners) discover new music through continuous curated stations, live reactions, and community engagement.

## What NETWORX is

The repo powers two connected products that share one backend, one account system, and one Next.js web app:

- **NETWORX Radio** — the listener and artist app: synchronized live stations, fire/poop voting, song clips and stories, Discover, chat, artist profiles, analytics, and Pro-Radio on-demand playlists.
- **Pro-Networx** — the professional network and services marketplace for creatives and **Catalysts** (service providers): profiles and portfolios, services, Studios, job board, beats, and DMs.

| Surface | Where | Notes |
|---------|-------|-------|
| Web (Radio) | https://www.networxradio.com | Next.js on Vercel |
| Web (Pro-Networx) | https://www.pro-networx.com | Same Next.js app; host-aware routing in `web/src/middleware.ts` |
| Backend API | Railway (`backend-production-17cc.up.railway.app`) | NestJS; web calls same-origin `/api`, rewritten to the backend |
| Mobile | iOS App Store + Google Play | Flutter app `com.tmaktechnologies.networxradio` |

The core experience is live radio. Pro-Radio adds on-demand playlists for subscribers, and Discover plays short clips, but stations themselves have no user-initiated skip.

## Purpose & Vision

### The problem
Independent artists struggle to get heard through traditional radio and algorithm-heavy streaming platforms. Exposure is inconsistent, gatekept, and often disconnected from real listener feedback.

### The NETWORX approach
NETWORX gives independent artists a direct path to exposure through a transparent, artist-first radio system:

- **For Artists:** Upload tracks, buy placements per song, and earn airtime in live station rotation with analytics and real-time audience signals
- **For Prospectors (Listeners):** Discover new music through continuous stations, votes, chat, clips, and stories
- **For Creatives and Catalysts:** Find collaborators, list services and studios, and get hired through Pro-Networx
- **For NETWORX:** Sustain the platform through placements, song and beat sales, and Pro-Radio / Pro-Networx subscriptions

## Quick Start (dev)

### Prereqs
- Node.js **22+** (the backend needs Node 22 for Supabase Realtime broadcasts)
- Flutter SDK **3.38+** (Dart 3.10+; current builds use Flutter 3.44)
- Xcode + CocoaPods for iOS, Android Studio / SDK 35 + JDK 17 for Android
- Supabase project, Firebase project + service account, Stripe account
- Redis (optional locally; required for multi-instance radio state and the push queue)

### Fast path

```bash
# Backend + Redis (Docker) — or: cd backend && npm install && npm run start:dev
docker compose up -d redis backend

# Web
cd web && npm install && npm run dev

# Mobile
cd mobile && flutter pub get && flutter run
```

- **Backend**: `http://localhost:3000` (all routes under `/api`; health check at `/api/health`)
- **Web**: `http://localhost:3001`
- **Mobile**: emulator/device — see [Mobile app setup](#mobile-app-setup) for pointing the app at a local backend

## Core Platform Features

- 🎵 **True radio** — multiple stations, server-synchronized playback, LIVE indicator, mute that persists across song and station changes, and reopen-last-station on launch
- 🔥 **Votes, ratings, and temperature** — fire / poop votes per play (from the player, mini player, lock screen, and iPhone Dynamic Island), a 1–10 listener rating, report reasons, and a decaying **song temperature** score; scores are split into popular and peer votes
- 💬 **Live Chat + song Comments** — station-wide live chat with emoji reactions, plus a per-song Comments thread that returns whenever the song plays
- 🎬 **Clips & song stories** — record the song that is on (hold-to-record camera, text and artist-credit stickers), share it to Instagram, send it in DMs, or post it as a public or friends-only story
- 🔍 **Discover & Search** — swipe feed, feed posts (video, audio, photos), search-as-you-type across radio and Pro-Networx, artist results as glass cards with sort (Popular / Most songs / Recent) and scope (Everyone / Following / Liked)
- 🎤 **Artist tools** — uploads with Full-Song Radio Opt-In, albums, synced lyrics (ElevenLabs), copyright matching (ACRCloud), analytics ("The Wake"), song and beat sales with Stripe Connect payouts, artist email lists; listeners become artists automatically on first upload or Pro profile save
- 📈 **Placements** — artists buy discovery placements per song (each placement funds about 100 listener exposures); new artists and producers receive welcome placements at signup
- 🎧 **Pro-Radio** — subscriber playlists of full songs, add-to-playlist from radio, artist pages, Discover, and Library
- 🧭 **Pro-Networx** — creative directory, services, Studios (map + listings), job board, beats, portfolios, shareable profiles, and DMs with message requests
- 🔴 **Live** — the admin DJ Booth with mic talk-over and Live Performances (WHIP/WHEP via Cloudflare Stream); artist self-serve livestreams turn on with `ARTIST_LIVE_ENABLED=true`
- 🧪 **The Refinery** — artists submit songs for structured listener review
- 📲 **Push + in-app notifications** — FCM device tokens, followed-artist and favorite-artist alerts, DM requests, app update prompts; scheduled pushes run on a BullMQ queue
- 🔗 **Sharing & deep links** — `https://www.networxradio.com/open/artists/:id`, station and Pro profile links open the installed app (Android App Links, iOS Universal Links, `networxradio://`)
- 🚗 **Platform integrations** — Android Auto station list, iOS Now Playing widget and lock-screen controls
- 👤 **Guest browsing** — browse without an account; sign-in is requested when you act (vote, message, upload)
- 🔐 **Account security** — Firebase Auth (email, Google, Apple), a unique mobile number with a text code on sign-in, unique display names and usernames, and a 48-hour restore window after account deletion
- 🛡️ **Admin & moderation** — song moderation with copyright flags, live queue editing (search, play next, drag to reorder), users (roles, streamer access, shadow / hard ban), activity flags for comment and like floods, reports, lyrics studio, payouts
- 🔍 **Observability** — Winston structured logs, request IDs, Sentry, `/api/health`

## Product Status

NETWORX is live on the web, the App Store, and Google Play, with active development across all surfaces.

### Latest highlights (Nov 2026)
- ✅ **Store launch readiness**: Mobile digital goods go through App Store and Google Play billing; deep links open shared artist, station, and Pro profile pages in the app.
- ✅ **Clips & stories**: Record the song on air, add stickers and text, share to Instagram or DMs, or post as a story.
- ✅ **Lock screen & Dynamic Island**: Current song, mute, and fire / poop votes without opening the app.
- ✅ **Guest browsing**: Explore radio and public artist / Pro pages before creating an account.
- ✅ **Account security**: Phone verification on sign-in, unique names, 48-hour deletion grace.
- ✅ **Radio player**: Per-song Comments, ratings and report reasons, swipe-down to close, fire / poop on the web mini player.
- ✅ **Backend cost & scale**: Shared radio state in Redis, idle stations skip charges and logs, optional Cloudflare R2 media mirror.
- ✅ **Current mobile release**: **1.0.99 (133)**.

See **[`docs/changelog/2026-11.md`](docs/changelog/2026-11.md)** (latest), [`2026-08.md`](docs/changelog/2026-08.md), [`2026-07.md`](docs/changelog/2026-07.md), [`2026-06.md`](docs/changelog/2026-06.md), and **[`docs/business/networx-executive-brief.md`](docs/business/networx-executive-brief.md)**.

## Ads, interruptions, and rotation rules

- **No audio ads interrupt the live radio stream.** Stations play continuously; an optional jingle (`RADIO_JINGLE_URL`) fills gaps when a queue is empty.
- **Visual ads / sponsorships** can appear on web and mobile surfaces (e.g. the "Venue Partner" slot).
- **Placements**: artists fund airtime per song by buying placements; the backend charges a placement budget atomically when a song airs. Stations with no listeners still advance but skip charges.
- **Trial and free rotation**: approved songs with trial plays, artist opt-in (`opt_in_free_play`), and admin approval (`admin_free_rotation`) fill rotation when paid placements run out. See [`docs/radio-logic.md`](docs/radio-logic.md).
- **Auditability**: `play_decision_log` records why each song was chosen.

## Policies & legal

Public legal documents live on the web app under **Legal Center** (`/legal`), including:

- Terms of Service, Privacy Policy, Community Guidelines, Prohibited Content, Child Safety (CSAE)
- Artist Agreement, Buyer License, Service Provider Terms, Upload Rights, Payout Policy
- **[Full-Song Radio Opt-In Agreement](https://www.networxradio.com/full-song-radio-opt-in)** — radio + DJ programming authorization (required at upload)
- DMCA / Copyright Policy (takedown and counter-notice), Refunds, Livestream Terms, Beta Tester Terms, Delete Account, Report

Source pages: `web/src/app/(marketing)/…`. Store compliance packets: `docs/legal/`.

### Branding & product terminology

User-facing copy uses the following terms. See **[docs/branding-terminology.md](docs/branding-terminology.md)** for full definitions.

| Term | Meaning | Backend equivalent |
|------|---------|--------------------|
| **Prospectors** | Audience (listeners) | `listener`, `listener_count` |
| **Catalysts** | Service providers on Pro-Networx | `service_provider`, `service_providers` |
| **Ripples** | Profile saves + radio play votes (fire / poop) | `likes`, `leaderboard_likes` (`reaction`: `fire` / `shit`) |
| **The Wake** | Artist analytics report | analytics, stats |
| **The Yield** | Prospector rewards balance and redemption | prospector yield tables |
| **Ears reached** | Unique people who heard a song | analytics |

API paths, DB columns, and role values stay stable (e.g. `/songs`, `listener_count`, role `listener`). The repo folder is still named `RadioApp/`.

## Architecture

### Version compatibility

| Component | Version |
|-----------|---------|
| Node.js | 22+ |
| NestJS | 11.x |
| Next.js (web) | 16.1.4, React 19.2, Tailwind v4 |
| Next.js (admin) | 16.1.2 |
| Flutter / Dart | 3.38+ / ^3.10 |
| iOS deployment target | 15.0 |
| Android | compileSdk / targetSdk 35+, Java 17, AGP 8.11 |

### Technology stack

- **Mobile (Flutter, iOS + Android)** — `just_audio` + `audio_service` for radio and the media notification, Provider for state, Firebase Auth + FCM, `in_app_purchase` for App Store / Play billing, `flutter_stripe` for non-store payments, `camera` for clips, `home_widget` for the Now Playing widget, `geolocator` for Studios / Nearby, Sentry.
- **Web (Next.js App Router)** — marketing pages (SSR/ISR), Radio dashboard, Pro-Networx (`(ProNetworx)` route group on its own domain), web admin under `/admin`. shadcn/ui components, Hls.js playback, Firebase client auth with an Axios bearer-token interceptor, optional HTTP-only session cookies, Stripe Checkout, PWA with offline fallback (`/~offline`). Serves the Apple App Site Association and Android `assetlinks.json` from `/.well-known`.
- **Backend (NestJS)** — REST under `/api`; Firebase Admin for token verification and FCM; Supabase (service role) for data, storage, and Realtime broadcasts; Redis (ioredis) for shared radio state, listener counts, and emoji aggregation; BullMQ for scheduled pushes; Stripe (PaymentIntents, Checkout, subscriptions, Connect); Apple App Store Server API + Google Play Developer API for store purchases; Twilio for sign-in codes; ElevenLabs (lyrics), ACRCloud (copyright), Google Vision (image moderation), Cloudflare Stream (live); `@nestjs/schedule` cron jobs; Winston + Sentry.
- **Database & storage** — Supabase Postgres (migrations in `backend/supabase/migrations`) and Supabase Storage buckets created by migrations (`songs`, `artwork`, `avatars`, `feed`, `portfolio`, `resumes`, `dm-media`, `dj-soundboard`). New media can mirror to Cloudflare R2 when `R2_*` credentials are set.
- **Auth** — Firebase Authentication (email/password, Google, Apple) plus backend phone verification (`/api/auth/phone/*`).
- **Admin** — the main admin lives in the web app (`/admin`, plus admin screens in the mobile app). `admin/` is a small standalone Next.js dashboard for song moderation, users, and analytics.

### Data flow

```
Mobile (Flutter) / Web (Next.js, same-origin /api rewrite)
    ↓  HTTPS + Firebase ID token
Backend API (NestJS on Railway)
    ├─ Supabase Postgres + Storage (+ Realtime broadcasts)
    ├─ Redis (radio state, counts, BullMQ queue)
    ├─ Firebase Admin (auth, FCM)
    └─ Stripe / App Store / Google Play / Twilio / ElevenLabs / ACRCloud / Cloudflare
```

### Authentication flow

1. The client signs in with Firebase Auth (email, Google, or Apple) and gets an ID token.
2. Requests send `Authorization: Bearer <token>`; `FirebaseAuthGuard` verifies it and loads the Supabase user (ban checks included).
3. Signed-in users without a verified phone are asked for a text code (`PHONE_MFA_REQUIRED`); `/api/auth/phone/send` and `/api/auth/phone/verify` complete it.
4. Public routes (e.g. `GET /api/radio/current`, public artist and Pro profiles) work without a token, which powers guest browsing.
5. **Web**: `POST /api/auth/login` (Next.js route) can mint an HTTP-only session cookie for SSR; if that fails locally, client-side bearer auth still works. Cross-domain sign-in between networxradio.com and pro-networx.com uses `/api/auth/cross-domain-token` and `/auth-handoff`.

### Payment flow

| Platform | Digital goods (placements, songs/beats, subscriptions, tips) | Confirmation |
|----------|---------------------------------------------------------------|--------------|
| iOS | Apple In-App Purchase → `POST /api/payments/app-store/complete` | App Store Server Notifications V2 → `/api/payments/app-store/notifications` |
| Android | Google Play Billing → `POST /api/payments/google-play/complete` | Play RTDN → `/api/payments/google-play/rtdn` |
| Web | Stripe Checkout Sessions | Stripe webhook → `/api/payments/webhook` |

Stripe webhook events handled: `payment_intent.succeeded` / `payment_failed`, `checkout.session.completed` / `async_payment_succeeded` / `async_payment_failed` / `expired`, `customer.subscription.updated` / `deleted`, `account.updated` (Connect), `setup_intent.succeeded`. Artist song-sale earnings pay out through Stripe Connect (`/api/payments/connect/*`). `BETA_ALL_FREE=true` unlocks paid features for an explicit free test window.

## Project Structure

```
RadioApp/
├── mobile/              # Flutter app (iOS + Android)
├── backend/             # NestJS API + Supabase migrations
├── web/                 # Next.js web app (Radio, Pro-Networx, web admin)
├── admin/               # Standalone Next.js admin dashboard
├── docs/                # Specs, runbooks, changelogs, business docs
├── docker-compose.yml   # Local backend + Redis
├── .env.example         # Env template used by docker compose
└── railway.env.example  # Railway/Vercel variable template
```

### Mobile (`mobile/`)

```
mobile/
├── lib/
│   ├── main.dart                # Firebase, Sentry, dotenv init; AuthWrapper (sign-in / guest / phone gate)
│   ├── firebase_options.dart
│   ├── core/                    # auth, services (api, radio, chat…), models, navigation, theme, constants
│   ├── features/                # one folder per area (see below)
│   └── widgets/                 # shared widgets (home shell, player bar, nav drawer…)
├── android/                     # Kotlin host, Android Auto, Now Playing widget, key.properties
├── ios/                         # Runner, NowPlayingWidget extension, build_appstore.sh
├── integration_test/            # app_smoke_test.dart
└── test/                        # unit + widget tests
```

Feature folders: `about`, `account`, `admin`, `analytics`, `apply`, `artist`, `auth`, `competition`, `credits`, `dashboard`, `dimension`, `discovery`, `help_legal`, `home`, `invite`, `job_board`, `listening`, `livestream`, `messages`, `nearby`, `notifications`, `payment`, `player`, `pro_networx`, `pro_radio`, `profile`, `refinery`, `room`, `search`, `settings`, `social`, `studio`, `studios`, `tutorial`, `upload`, `welcome`, `yield`.

### Web (`web/`)

```
web/src/
├── app/
│   ├── (marketing)/     # Home, about, pricing, FAQ, legal pages, public artist / song / station pages, /open/artists/:id
│   ├── (auth)/          # login, signup
│   ├── (dashboard)/     # listen, discover, browse, competition, messages, notifications, room, refinery,
│   │                    # pro-radio, studios, live / watch / go-live, settings, artist/*, admin/*
│   ├── (ProNetworx)/    # /pro-networx/* (home, directory, feed, services, studios, jobs, beats, me, u/:id)
│   ├── api/             # auth/login + logout, and proxies for songs / users / discovery / analytics
│   └── .well-known/     # apple-app-site-association, assetlinks.json
├── components/          # ui (shadcn), radio, playback, chat, pro-networx, admin, …
├── contexts/  hooks/  lib/
└── middleware.ts        # host-aware routing for networxradio.com vs pro-networx.com
```

Run `find web/src/app -name page.tsx` for the full route list.

### Backend (`backend/`)

```
backend/
├── src/
│   ├── main.ts           # bootstrap: Firebase, Supabase, CORS, ValidationPipe, /api prefix
│   ├── app.module.ts
│   ├── common/           # logger, Sentry, filters, request IDs, R2 storage, beta access
│   ├── config/           # firebase, supabase, redis, postgres
│   └── <modules>/        # one folder per domain (see below)
├── supabase/migrations/  # numbered SQL migrations
├── scripts/              # apply-supabase-migrations, setup-storage, backfill-copyright, list-routes, …
└── test/                 # e2e + route auth matrix
```

Modules: `admin`, `albums`, `analytics`, `app-version`, `artist-live`, `auth`, `browse`, `chat`, `competition`, `copyright`, `creator-network`, `credits`, `discovery`, `dj-booth`, `email`, `fans`, `feed`, `flags`, `growth`, `job-board`, `leaderboard`, `live-services`, `lyrics`, `moderation`, `notifications`, `payments`, `playlists`, `pro-bundle-subscription`, `pro-network-subscription`, `pro-networx`, `pro-radio-subscription`, `push-notifications`, `radio`, `refinery`, `service-messages`, `service-providers`, `song-stories`, `songs`, `spotlight`, `streaming`, `studios`, `suggestions`, `tasks`, `uploads`, `users`, `venue-ads`, `yield`.

### Documentation (`docs/`)

```
docs/
├── api-spec.md               # API endpoints
├── database-schema.md        # Schema reference
├── radio-logic.md            # Track selection, tiers, artist spacing
├── features-summary.md       # Cross-platform feature matrix
├── mobile-web-parity-matrix.md
├── testing.md                # Test runbook (backend route matrix, mobile, web)
├── env-variables-setup.md    # Railway + Vercel env vars
├── railway-setup.md  production-networxradio.md  deploy-railway-vercel-namecheap.md
├── google-play-*.md  apple-app-store-review-checklist.md  play-store-listing.md
├── runbooks/                 # Stripe setup for Pro-Radio, Pro-Networx, Pro bundle
├── changelog/                # Monthly changelogs (latest: 2026-11.md)
├── business/                 # Executive brief, decision log, timeline, badges & Refinery
├── notion/                   # NetworX Notion OS
└── legal/                    # Store compliance packets
```

Mobile store docs live in `mobile/docs/` (`IOS_APP_STORE.md`, `APP_STORE_IAP.md`, `SIGN_IN_WITH_APPLE.md`).

### Notion workspace

**NetworX Notion OS**: business + engineering hub with linked databases (Initiatives, Features, Decisions, Releases, Timeline, Doc Registry, Risks, Markets & Events) and Executive / Engineering dashboards.

- **Primary hub:** [NetworX on Notion](https://app.notion.com/p/38b7fab2671481aeb2f3faf0cf4a5515) · [`docs/notion/networx-workspace.md`](docs/notion/networx-workspace.md)
- **Views reference:** [`docs/notion/networx-notion-views.md`](docs/notion/networx-notion-views.md)
- **Archive (legacy RadioApp workspace):** [`docs/notion/notion-workspace-created.md`](docs/notion/notion-workspace-created.md)

## Setup Instructions

Quick reference: [`SETUP.md`](SETUP.md). Firebase: [`FIREBASE_QUICK_START.md`](FIREBASE_QUICK_START.md) / [`FIREBASE_COMPLETE_SETUP.md`](FIREBASE_COMPLETE_SETUP.md). Windows tooling: [`ANDROID_SDK_SETUP.md`](ANDROID_SDK_SETUP.md), [`QUICK_ANDROID_SDK_FIX.md`](QUICK_ANDROID_SDK_FIX.md), [`WINDOWS_DEVELOPER_MODE.md`](WINDOWS_DEVELOPER_MODE.md).

### Database

Apply the numbered SQL files in `backend/supabase/migrations/` in order (Supabase SQL editor, Supabase MCP, or the script below). Migrations also create the storage buckets and RLS policies.

```bash
# from repo root; uses DATABASE_URL (direct Postgres connection)
npx ts-node backend/scripts/apply-supabase-migrations.ts
```

### Backend setup

```bash
cd backend
npm install
cp .env.example .env   # fill in Firebase, Supabase, Stripe, …
npm run start:dev      # http://localhost:3000/api
```

Minimum env: Firebase Admin credentials (`FIREBASE_SERVICE_ACCOUNT_PATH`, or `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Everything else is optional or feature-specific — see [`backend/ENV_REQUIREMENTS.md`](backend/ENV_REQUIREMENTS.md).

Without Twilio credentials, local sign-in codes are written to the backend log. Without `REDIS_URL`, radio state stays in memory and the push queue is disabled.

### Running with Docker

`docker-compose.yml` runs the backend (Node 22 Alpine with ffmpeg) and Redis 7.

1. Install Docker (Docker Desktop on macOS/Windows, or Docker Engine in WSL).
2. Create `.env` at the repo root from `.env.example` (Compose uses `env_file: .env`).
3. Save the Firebase service-account JSON at the path mounted in `docker-compose.yml` (`docs/radioapp-4c14a-firebase-adminsdk-*.json`; `*adminsdk*.json` is gitignored). Compose sets `FIREBASE_SERVICE_ACCOUNT_PATH` inside the container.
4. Start:
   ```bash
   docker compose up -d redis backend      # or: docker compose up --build -d
   docker compose logs -f backend          # look for "Redis client connected"
   ```

### Web app setup

```bash
cd web
npm install
npm run dev    # http://localhost:3001 (Turbopack)
```

Set env in `web/.env.local`. The browser calls same-origin `/api`; `next.config.ts` rewrites it to `BACKEND_URL` (or `NEXT_PUBLIC_API_URL`, default `http://localhost:3000`). See [`web/README.md`](web/README.md).

### Mobile app setup

```bash
cd mobile
flutter pub get
cp .env.example .env
flutter run
```

- Firebase config: `android/app/google-services.json` and `ios/Runner/GoogleService-Info.plist` (Firebase project `radioapp-4c14a`, app id `com.tmaktechnologies.networxradio`).
- The app tries `API_DIRECT_URL`, then the Railway backend, then `API_BASE_URL`. To use a local backend, set **both** `API_DIRECT_URL` and `API_BASE_URL` (Android emulator: `http://10.0.2.2:3000`; physical device: your machine's LAN IP).
- See [`mobile/README.md`](mobile/README.md) for env keys, release builds, and billing.

### Admin dashboard (standalone)

```bash
cd admin
npm install
npm run dev -- -p 3002   # default port 3000 collides with the backend
```

See [`admin/README.md`](admin/README.md). Most admin work happens in the web app at `/admin`.

## Development Workflow

### Running the full stack

| Terminal | Command | URL |
|----------|---------|-----|
| 1 | `cd backend && npm run start:dev` | http://localhost:3000/api |
| 2 | `cd web && npm run dev` | http://localhost:3001 |
| 3 | `cd mobile && flutter run` | device / emulator |

### Testing

- **Backend**: `npm test` (Jest unit), `npm run test:routes` (route inventory + auth matrix), `npm run test:e2e`
- **Mobile**: `flutter test`; device smoke: `flutter test integration_test/app_smoke_test.dart`
- **Web**: `npm run test:e2e` (Playwright)
- **CI** (`.github/workflows/test.yml`): backend unit + route matrix, Flutter tests, Android debug APK, iOS unsigned build, web Playwright smoke

Full runbook: [`docs/testing.md`](docs/testing.md).

### Environment variables

| App | Template / location | Reference |
|-----|---------------------|-----------|
| Backend | `backend/.env.example` → `backend/.env` | [`backend/ENV_REQUIREMENTS.md`](backend/ENV_REQUIREMENTS.md) |
| Web | `web/.env.local` | [`web/README.md`](web/README.md) |
| Mobile | `mobile/.env.example` → `mobile/.env` | [`mobile/README.md`](mobile/README.md) |
| Admin | `admin/.env.local` | [`admin/README.md`](admin/README.md) |
| Production | Railway + Vercel | [`docs/env-variables-setup.md`](docs/env-variables-setup.md) |

### Deploy & release

- **Backend**: Railway builds `backend/Dockerfile` (see [`docs/railway-setup.md`](docs/railway-setup.md)).
- **Web**: Vercel builds `web/` with `next build --webpack`.
- **iOS**: `cd mobile && ./ios/build_appstore.sh` builds a signed IPA into `mobile/build/ios/ipa/`; upload with Transporter or Xcode Organizer. See [`mobile/docs/IOS_APP_STORE.md`](mobile/docs/IOS_APP_STORE.md).
- **Android**: `cd mobile && flutter build appbundle --release` (needs `android/key.properties`). See [`docs/google-play-release-checklist.md`](docs/google-play-release-checklist.md).

### Common development tasks

- **New API endpoint**: add a controller/service in the matching `backend/src/<module>/`
- **New web page**: add a `page.tsx` under the right route group in `web/src/app/`
- **New mobile screen**: add it under `mobile/lib/features/<area>/` and register it in `core/navigation/app_router.dart`
- **Database change**: add the next numbered file in `backend/supabase/migrations/` and update `docs/database-schema.md`
- **Firebase change**: regenerate `mobile/lib/firebase_options.dart` with `flutterfire configure`

## API

See [`docs/api-spec.md`](docs/api-spec.md) for the endpoint reference and [`docs/radio-logic.md`](docs/radio-logic.md) for how the backend picks tracks.

- **Mobile + API clients**: send the Firebase ID token as `Authorization: Bearer <token>` to `/api/*`.
- **Web**: same bearer token via the Axios interceptor; optional HTTP-only session cookie from `web/src/app/api/auth/login/route.ts` for SSR.
- `npm run test:routes:inventory` in `backend/` prints every route.

### Key endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Liveness + Supabase check |
| `/api/radio/current` | GET | No | Current track with position for a station |
| `/api/leaderboard/songs/:id/like` | POST | User | Fire / poop vote on the current play |
| `/api/auth/phone/send`, `/api/auth/phone/verify` | POST | User | Sign-in text code |
| `/api/songs/upload-url` | POST | Artist | Signed upload URL |
| `/api/songs/library` | GET | User | Saved songs |
| `/api/analytics/me` | GET | Artist | Artist analytics |
| `/api/analytics/platform` | GET | No | Platform-wide stats |
| `/api/discovery/people` | GET | User | Creatives / artists with filters |
| `/api/pro-networx/public/profiles/:userId` | GET | No | Public Pro profile |
| `/api/messages/conversations/:otherUserId` | GET/POST | User | DM thread + send |
| `/api/job-board/requests` | GET/POST | User | Service requests |
| `/api/payments/app-store/complete` | POST | User | Verify an App Store purchase |
| `/api/payments/google-play/complete` | POST | User | Verify a Google Play purchase |
| `/api/payments/checkout-session-song-plays` | POST | Artist | Stripe Checkout for placements (web) |
| `/api/payments/webhook` | POST | Stripe signature | Stripe events |
| `/api/push-notifications/register-device` | POST | User | Register an FCM token |
| `/api/admin/songs/:id` | PATCH | Admin | Update song status |
| `/api/admin/users/:id/hard-ban`, `/shadow-ban` | POST | Admin | Bans |
| `/api/admin/free-rotation/*` | GET/PATCH | Admin | Free rotation search and toggle |

## Troubleshooting

### Backend
- **Firebase private key parsing error**: prefer `FIREBASE_SERVICE_ACCOUNT_PATH`; otherwise keep `\n` escapes in `FIREBASE_PRIVATE_KEY` (see [`backend/FIREBASE_KEY_FORMAT.md`](backend/FIREBASE_KEY_FORMAT.md)).
- **Supabase connection error**: check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`; `GET /api/health` reports Supabase status.
- **Realtime events missing**: run the backend on Node 22+.
- **Stripe webhook errors**: `STRIPE_WEBHOOK_SECRET` must match the endpoint's signing secret.

### Web
- **Session cookie not set**: `FIREBASE_SERVICE_ACCOUNT_KEY` must be valid JSON; client-side login still works without it.
- **API 404 / unreachable**: set `BACKEND_URL` (Vercel) or start the backend on port 3000.
- **Large uploads return 413**: the client uploads directly to the Railway host; keep `NEXT_PUBLIC_API_URL` pointed at the backend.

### Mobile
- **App talks to production instead of local**: set `API_DIRECT_URL` as well as `API_BASE_URL`.
- **Google Sign-In `ApiException: 10`**: add your SHA-1 in Firebase (see [`mobile/TROUBLESHOOTING.md`](mobile/TROUBLESHOOTING.md)).
- **Build errors**: `flutter clean && flutter pub get`; on iOS also `cd ios && pod install`.

### General
- **CORS errors**: production origins are built in; add other origins to `CORS_ORIGIN`. `http://localhost:*` is always allowed.

## Security Best Practices

- **Never commit secrets**: service-account JSON, `.p8` keys, keystores, and real keys stay out of git and out of docs. Env var names are fine.
- **Rotate exposed keys** immediately in Firebase, Stripe, Supabase, Apple, Google Play, or Twilio.
- Gitignored patterns include `**/*adminsdk*.json`, `backend/config/*.json`, `*service*account*.json`, and `*private*key*`.
- Some env files (`backend/.env`, `mobile/.env`, `web/.env.local`) are tracked in this private repo; treat the repo as confidential.

## Contributing

This is a private project. For internal contributors:

1. Create a feature branch from `main`
2. Make changes and test thoroughly
3. Update documentation as needed
4. Commit with descriptive messages
5. Push and create a pull request

## License

Private project - All rights reserved
