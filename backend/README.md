# NETWORX Backend API

NestJS 11 API for NETWORX Radio and Pro-Networx. Deployed on Railway (`backend/Dockerfile`, Node 22 + ffmpeg); the web app reaches it through same-origin `/api` rewrites and the mobile app calls it directly.

## Overview

The backend handles:

- **Authentication**: Firebase token verification, role-based access, phone text-code verification on sign-in, cross-domain sign-in tokens, bans, 48-hour account-deletion grace
- **Users & social**: profiles, unique display names / usernames, follows, favorites, blocks, reports, friends
- **Songs**: uploads (multipart + signed URLs), albums, lyrics, likes / favorites, ratings, Discover swipes and samples, song and beat sales, copyright matching
- **Radio**: multi-station rotation with Redis-backed shared state, play voting and song temperature, presence / listener counts, idle-station savings, jingles, admin queue control
- **Chat**: station Live Chat, per-song Comments, emoji reactions
- **Discovery & Pro-Networx**: creative directory, Catalyst (service provider) profiles, listings, portfolios, resumes, Studios, job board, service messages, public profiles
- **Feed & stories**: Discover feed posts (video / audio / images), song stories, bookmarks
- **Payments**: Stripe (Checkout, PaymentIntents, subscriptions, Connect payouts), Apple App Store and Google Play purchase verification, placements per song
- **Subscriptions**: Pro-Radio, Pro-Networx, Pro bundle, Creator Network
- **Live**: DJ Booth, live broadcasts, artist livestreams (Cloudflare Stream WHIP/WHEP), stream chat and donations
- **Engagement**: notifications, FCM push (BullMQ queue for scheduled pushes), email, growth (referrals, history, search), competition and leaderboards, Refinery reviews, Yield
- **Admin**: moderation, users, queue, fallback playlist, free rotation, feed, reports, activity flags, payouts
- **Observability**: Winston logs, request IDs, Sentry, `/api/health`

## Tech Stack

- **Framework**: NestJS 11 with TypeScript
- **Database**: Supabase (PostgreSQL); optional direct `pg` pool via `DATABASE_URL`
- **Storage**: Supabase Storage, optional Cloudflare R2 mirror
- **Cache / queue**: Redis (ioredis) + BullMQ
- **Authentication**: Firebase Admin SDK, Twilio SMS for sign-in codes
- **Payments**: Stripe, App Store Server API, Google Play Developer API
- **Integrations**: ElevenLabs (lyrics), ACRCloud (copyright), Google Vision (image moderation), Cloudflare Stream (live)
- **Scheduling**: `@nestjs/schedule`
- **Logging / errors**: Winston, Sentry

## Prerequisites

- Node.js 22+ (Supabase Realtime broadcasts need Node 22's native WebSocket)
- npm
- Supabase project with migrations applied (`supabase/migrations/`)
- Firebase project with a service account
- Stripe account (for web payments)
- ffmpeg on the PATH (or `FFMPEG_PATH`) for clip trims and transcodes
- Redis (optional locally)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**: copy `.env.example` to `.env` and fill it in. Minimum:
   ```env
   # Firebase Admin — either a JSON file path…
   FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/service-account.json
   # …or the three fields
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key

   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx

   PORT=3000
   NODE_ENV=development
   WEB_URL=http://localhost:3001
   ```
   Full list: [`ENV_REQUIREMENTS.md`](ENV_REQUIREMENTS.md).

   > **Security Note**: Never commit Firebase service account JSON files or new secrets.

3. **Apply migrations** (from the repo root, with `DATABASE_URL` set):
   ```bash
   npx ts-node backend/scripts/apply-supabase-migrations.ts
   ```

4. **Run the server**:
   ```bash
   # Development (watch mode)
   npm run start:dev

   # Production
   npm run build
   npm run start:prod
   ```

## Project Structure

```
backend/
├── src/
│   ├── main.ts             # Firebase + Supabase init, CORS, ValidationPipe, /api prefix
│   ├── app.module.ts
│   ├── app.controller.ts   # GET /api, GET /api/health
│   ├── common/             # logger, Sentry, filters, request IDs, R2 storage, beta access
│   ├── config/             # firebase, supabase, redis, postgres
│   ├── auth/               # guards (Firebase, roles, phone MFA), decorators, phone + cross-domain auth
│   ├── radio/              # rotation, radio state, presence
│   ├── songs/  albums/  lyrics/  copyright/  uploads/
│   ├── payments/           # Stripe, App Store, Google Play, Connect, product catalog
│   ├── credits/            # placement budget + welcome placements
│   ├── pro-networx/  service-providers/  discovery/  studios/  job-board/
│   ├── push-notifications/ notifications/  email/  growth/
│   ├── admin/  moderation/  tasks/ (cron jobs)
│   └── …                   # one folder per remaining domain module
├── supabase/migrations/    # numbered SQL migrations
├── scripts/                # apply-supabase-migrations, setup-storage, backfill-copyright,
│                           # transcode-lossless-songs, migrate-media-to-r2, list-routes, …
├── test/                   # e2e + route auth matrix
├── Dockerfile
└── package.json
```

## API Endpoints

All routes are under `/api`. Protected routes require `Authorization: Bearer <firebase-id-token>`; routes marked `@Public()` (e.g. `GET /api/radio/current`, public profiles, webhooks) do not. Signed-in users must also pass phone verification unless a route skips it.

Print every route with:

```bash
npm run test:routes:inventory
```

Highlights (see `../docs/api-spec.md` for details):

### Auth & users
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/verify` | GET | Verify token and return role |
| `/api/auth/phone/send` · `/api/auth/phone/verify` | POST | Sign-in text code |
| `/api/auth/cross-domain-token` · `/api/auth/cross-domain-exchange` | POST | Sign-in handoff between domains |
| `/api/users` | POST | Create user profile |
| `/api/users/me` | GET / PUT / DELETE | Current user; delete starts the 48-hour grace period |
| `/api/users/username-available` | GET | Username check |
| `/api/users/:id/follow` · `/favorite` · `/block` | POST / DELETE | Social actions |
| `/api/users/:id/report` | POST | Report a user |

### Songs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/songs/upload` | POST | Upload song (multipart) |
| `/api/songs/upload-url` | POST | Signed upload URL (artists) |
| `/api/songs` · `/api/songs/:id` | GET | List / details |
| `/api/songs/mine` · `/api/songs/library` · `/api/songs/favorites` | GET | Artist's songs, saved songs, favorites |
| `/api/songs/:id/like` · `/favorite` | POST / DELETE | Like, favorite |
| `/api/songs/:id/rating` | GET / POST | 1–10 listener rating |
| `/api/songs/artists/search` | GET | Artist search |
| `/api/songs/beats/marketplace` | GET | Beat marketplace |

### Radio & chat
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/radio/current` | GET | Current track + position for a station (public) |
| `/api/radio/next` | GET | Advance / fetch next track |
| `/api/radio/play` | POST | Report play event |
| `/api/radio/presence` | POST | Listener heartbeat |
| `/api/leaderboard/songs/:id/like` | POST | Fire / poop vote on the current play |
| `/api/leaderboard/songs` · `/api/leaderboard/upvotes-per-minute` | GET | Leaderboards, Trial by Fire |

### Payments
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/song-play-price` | GET | Placement pricing for a song |
| `/api/payments/checkout-session-song-plays` | POST | Stripe Checkout for placements (web) |
| `/api/payments/songs/:songId/checkout` | POST | Buy a song or beat (web) |
| `/api/payments/create-pro-radio-checkout-session` (and Pro-Networx / Pro bundle variants) | POST | Subscriptions (web) |
| `/api/payments/app-store/complete` · `/complete-subscription` | POST | Verify App Store purchases |
| `/api/payments/google-play/complete` · `/complete-subscription` | POST | Verify Google Play purchases |
| `/api/payments/app-store/notifications` | POST | App Store Server Notifications V2 |
| `/api/payments/google-play/rtdn` | POST | Google Play RTDN |
| `/api/payments/connect/onboard` · `/status` · `/login-link` | POST / GET | Stripe Connect payouts |
| `/api/payments/webhook` | POST | Stripe webhook |
| `/api/payments/transactions` | GET | Transaction history |

### Analytics, discovery, Pro-Networx
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/me` | GET | Artist analytics summary |
| `/api/analytics/platform` | GET | Platform stats |
| `/api/discovery/people` | GET | Search creatives / artists with filters |
| `/api/pro-networx/directory` · `/api/pro-networx/public/directory` | GET | Pro directory |
| `/api/pro-networx/public/profiles/:userId` | GET | Public Pro profile |
| `/api/service-providers/:userId` | GET | Provider profile + listings + portfolio |
| `/api/service-providers/me/profile` | PUT | Update current user's provider profile |
| `/api/service-providers/me/listings` · `/me/portfolio` | POST | Add listing / portfolio item |
| `/api/venue-ads/current` | GET | Current venue ad for a station |

### Admin (requires admin role)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/songs` | GET | List songs |
| `/api/admin/songs/:id` | PATCH | Update song status |
| `/api/admin/analytics` | GET | Platform stats |
| `/api/admin/users` | GET | List users |
| `/api/admin/users/:id/role` | PATCH | Update user role |
| `/api/admin/users/:id/hard-ban` · `/shadow-ban` · `/lifetime-ban` · `/restore` | POST | Enforcement |
| `/api/admin/free-rotation/*` | GET / PATCH | Free rotation search and toggle |

## Available Scripts

- `npm run start:dev` - Development with hot reload
- `npm run start:prod` - Run the compiled build
- `npm run build` - Build the project
- `npm run lint` - ESLint with `--fix`
- `npm run test` - Unit tests (Jest)
- `npm run test:e2e` - E2E tests
- `npm run test:routes` - Route inventory + auth matrix (runs in CI)

## Production Considerations

### File uploads

Multipart song uploads are buffered in memory by Multer (100MB cap), so many concurrent uploads raise memory use. Clients prefer signed upload URLs, which send files straight to Supabase Storage; feed media and large phone videos always use that path. Lossless uploads are transcoded to MP3 with ffmpeg.

### Radio logic and synchronization

Track selection lives in `src/radio/radio.service.ts`. See **`../docs/radio-logic.md`** for full detail. Summary:

- **Free vs paid mode**: listener-count thresholds with hysteresis (`THRESHOLD_ENTER_PAID` / `THRESHOLD_EXIT_PAID`); paid mode uses four-tier selection (placements → trial → opt-in → free rotation / admin fallback).
- **Artist spacing**: the same artist is not played back-to-back.
- **Shared state**: the station lock and last-good song live in Redis so multiple instances agree; clients get `started_at` and `server_time` for sync.
- **Idle stations**: stations with no listeners still advance but skip plays, decision logs, temperature refresh, and charges.
- **Background rotation**: a timer (`RADIO_BACKGROUND_POLL_MS`, default 45s) keeps stations moving between client requests.

### Scheduled jobs

`src/tasks/` runs cleanup (chat archival, rejected songs, automated-notification and play-decision-log pruning, scheduled account deletions, quarantining broken radio audio), competition rollovers, and the daily diamond job. `growth` sends weekly digests.

## Observability

- **Structured Logging**: Winston, JSON in production
- **Request Tracing**: `x-request-id` on every request and log line
- **Error Reporting**: Sentry captures 5xx errors (`SENTRY_DSN`)
- **Health**: `GET /api/health` returns uptime and Supabase latency (503 when Supabase is down)

## Security

- **Never commit secrets**: Firebase JSON keys and `.p8` files stay out of git
- **Credential rotation**: rotate exposed credentials immediately in the provider console
- **Token verification**: protected endpoints verify Firebase ID tokens and reject banned accounts
- **Role-based access**: guards enforce roles (`listener`, `artist`, `service_provider`, `admin`, …)
- **CORS**: production origins for networxradio.com and pro-networx.com are built in; `CORS_ORIGIN` adds more; `http://localhost:*` is allowed

## Database Schema

See `../docs/database-schema.md` and `supabase/migrations/`.

Key tables:
- `users` - profiles, role, phone verification, deletion schedule
- `songs` - metadata, status, placement budget (`credits_remaining`), trial plays
- `plays`, `play_decision_log` - play history and selection audit
- `likes`, `leaderboard_likes`, `song_favorites`, `song_temperature` - saves, votes, scores
- `transactions`, `credits`, `song_purchases` - payments, welcome placements, sales
- `chat_messages`, `notifications`, `user_device_tokens` - chat, inbox, push
- `service_providers`, `service_listings`, `studios` - Pro-Networx
- `rotation_queue` - radio queue
