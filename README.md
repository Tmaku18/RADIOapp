# NETWORX — Live Radio & Creator Network for Independent Artists

**By artists, for artists.**

NETWORX is a full-stack live radio platform and creator network built for underground and independent music. Artists upload tracks, fund airtime through credits, and get real-time exposure in a shared radio experience, while **Prospectors** (listeners) discover new music through a continuous curated stream, live reactions, and community engagement.

## What NETWORX is

NETWORX combines:
- **Live radio streaming** (shared “everyone hears the same thing” playback)
- **Artist infrastructure** (uploads, credits, analytics, notifications)
- **Community engagement** (Ripples, live chat, reactions)
- **Admin moderation tools** (approvals, rotation controls, user management)

This is **not** an on-demand streaming app. NETWORX is built around a real-time radio experience with artist-first discovery.

## Purpose & Vision

### The problem
Independent artists struggle to get heard through traditional radio and algorithm-heavy streaming platforms. Exposure is inconsistent, gatekept, and often disconnected from real listener feedback.

### The NETWORX approach
NETWORX gives independent artists a direct path to exposure through a transparent, artist-first radio system:

- **For Artists:** Upload tracks, allocate credits, and earn airtime in a live station rotation with analytics and real-time audience signals
- **For Prospectors (Listeners):** Discover new music through a continuous stream, live chat, and reactions
- **For NETWORX:** Sustain the platform through credit purchases, premium tools, and future subscriptions

## Quick Start (dev)

### Prereqs
- Node.js **22+**
- Flutter SDK **3.38+**
- Supabase project + keys
- Firebase project + service account
- Stripe account (for payments flows)

### Fast path

```bash
docker compose up -d redis backend
```

```bash
cd web && npm run dev
```

```bash
cd mobile && flutter run
```

- **Backend**: `http://localhost:3000`
- **Web**: `http://localhost:3001`
- **Mobile**: emulator/device (see setup section for `API_BASE_URL`)

## Core Platform Features

- 🎵 **True Radio Experience** — synchronized playback across clients with LIVE indicator and radio-style controls
- 🔄 **Continuous Playback** — auto-advance, deterministic shuffle, and no user-initiated skip in the core radio flow
- 🎤 **Artist Uploads** — secure uploads with server-side validation and moderation workflows
- 💳 **Credit System** — artists buy credits and allocate airtime to tracks (audited allocation + play decisions)
- 🆓 **Trial Rotation** — newly approved tracks receive free trial plays before paid rotation
- ❤️ **Ripples** — live likes/votes on tracks during airtime (vote-once-per-play on radio)
- 💬 **Live Radio Chat** — real-time chat + reactions for shared listening
- 📲 **Artist Notifications** — “Up Next” and “Live Now” push alerts via FCM
- 📊 **Admin Tools** — moderation, free rotation management, fallback playlist, and user enforcement tools
- 🔐 **Secure Auth + Payments** — Firebase Auth + Stripe (mobile + web payment flows)
- ⚡ **Scalable Backend State** — Redis-backed radio state, listener counts, and realtime fan-out
- 🔍 **Observability** — structured logs, request tracing, and Sentry error reporting

## Product Status

NETWORX is in active development with working web, mobile, and backend surfaces.

- ✅ **Implemented**: available now
- 🧪 **Beta / behind flag**: implemented but evolving
- 🚧 **In progress**: under active development
- 📌 **Planned**: not implemented yet

### Latest highlights (Mar 2026)
- ✅ **Streamer approval**: Artists and Catalysts must request streaming access; admin approves in **Admin → Streamers**. Only approved users can go live.
- ✅ **Stream settings** (own menu): Dedicated **Stream settings** page/menu for request access, pending state, and (when approved) Stream Manager + Live services. Web: sidebar + `/stream-settings`; mobile: More sheet → Stream settings.
- ✅ **Discover (IG-style)**: Tabs For you / Artists / Catalysts with search and filters; combined artist + Pro-Networx profiles; primary-accent styling
- ✅ **Bottom nav (web)**: Twitch/IG-style bottom bar: Home, Discover, Live, Activity, Profile (fixed; brand primary for active).
- ✅ **Live discovery**: `/live` page lists live sessions; sort by viewers/recent; profile Go Live opens Stream Manager (web) or Stream settings (mobile).

See **[`docs/changelog/2026-02.md`](docs/changelog/2026-02.md)** and **[`docs/changelog/2026-03.md`](docs/changelog/2026-03.md)** for full changelogs.

## Ads, interruptions, and rotation rules (clarifications)

- **No audio ads interrupt the live radio stream**. The core radio experience is continuous playback.
- **Visual ads / sponsorships** can appear on web/mobile surfaces (e.g. “Venue Partner” slot).
- **Artist pages / on-demand experiences** may include sponsorship placements (visual, and optionally audio on artist-owned playback surfaces).

**Paid / priority rotation with transparent rules**
- **Trial Rotation**: newly approved tracks get free trial plays before requiring credits.
- **Paid Rotation (credits)**: artists fund airtime by allocating credits to tracks; the backend pre-charges atomically before play.
- **Auditability**: `play_decision_log` + allocation/transaction tables exist to support transparency.

## Policies (placeholders)

NETWORX touches music rights, payments, and moderation. Before public release, add/confirm:

- **Copyright / rights ownership**
- **DMCA takedown process**
- **Content moderation policy**
- **Refund policy for credits/payments**
- **Artist terms / listener terms**

### Branding & product terminology

User-facing copy uses the following terms. See **[docs/branding-terminology.md](docs/branding-terminology.md)** for full definitions and rationale.

| Term | Meaning | Backend equivalent |
|------|---------|--------------------|
| **Prospectors** | Audience (listeners) | `listener`, `listener_count` |
| **Ripples** | Likes/votes on tracks | `likes` |
| **The Wake** | Artist analytics report; tagline: *“The path left behind by a thousand Ripples.”* | analytics, stats |
| **The Yield** | Prospector rewards balance and redemption | prospector yield tables |
| **Songs** | Tracks/songs | `song`, `songs` |

API paths, DB columns, and role values are unchanged (e.g. `/songs`, `listener_count`, role `listener`).

## API auth cheat sheet

- **Mobile + API clients**: send Firebase ID token as `Authorization: Bearer <token>` to `/api/*`.
- **Web (SSR dashboard)**: uses HTTP-only session cookies created by `web/src/app/api/auth/login/route.ts` for server-rendered routes.

### Legacy/internal naming (one-time note)
- Repo/folder name: `RadioApp/`
- Historical naming: “Discover Me” (pivot-era docs/notes)
- Technical values remain stable for compatibility (e.g. role `listener`, `/songs`, `/likes`)

## Web ↔ Mobile Parity (Engine surfaces)

The product “Engine” pages now share the same look/feel and core behaviors across **web** and **mobile**:

- **Stage / Listen**
  - Shared now-playing layout + glass/noir styling
  - Pinned catalyst credits (during airtime)
  - Rising Star alert banner (realtime)
  - Venue Partner slot
  - Quick-buy “Add 5 Minutes” for the owning artist
- **Competition**
  - Likes + discoveries leaderboards
  - Trial by Fire (upvotes/min) leaderboard
- **Analytics**
  - ROI card
  - Listener heatmap proxy by region
- **Pro‑Directory**
  - PRO‑NETWORX directory + “Mentor” badge + Verified Catalyst
  - Sync‑Profile pages + Creator Network paywalled DMs
  - Build/edit PRO‑NETWORX profile (skills + availability)
  - Mobile uses the same `/pro-networx/*` backend endpoints as `pro-web/`

## Architecture

### Technology Stack

### Version compatibility

| Component | Version |
|----------|---------|
| Node.js | 22+ |
| NestJS | 11.x |
| Next.js | 16.x |
| Flutter | 3.38+ |

- **Frontend (Mobile)**: Flutter app for iOS and Android
  - Cross-platform mobile development
  - Real-time audio streaming with `just_audio`
  - Live chat with Supabase Realtime subscriptions
  - Push notifications via Firebase Cloud Messaging (FCM)
  - Nearby search in Pro-Directory via `geolocator` (requires location permissions on Android/iOS)
  - State management with Provider
  - Firebase Authentication integration
  - Stripe Payment Sheet for payments
  
- **Frontend (Web)**: Next.js (App Router) web application
  - App Router with SSR/ISR for SEO-optimized marketing pages
  - shadcn/ui component library (Button, Card, Dialog, Table, etc.) with NETWORX “Systematic Glow” styling (Royal Amethyst accents)
  - Dark mode toggle via settings dropdown in dashboard
  - Client-side dashboards for Prospectors, artists, and admins
  - HTTP-only session cookies for secure SSR
  - Hls.js for streaming audio playback
  - Stripe Checkout for web payments
  - PWA manifest + service worker + offline fallback (`/~offline`)
  
- **Backend**: NestJS API server
  - RESTful API architecture under `/api`
  - Firebase Admin SDK for token verification, FCM push notifications, and token revocation
  - Supabase client for database operations and Realtime broadcasting
  - Redis for stateless radio state management, emoji aggregation, and listener counts (ioredis)
  - Stripe integration with dual payment flows (PaymentIntent + Checkout Sessions)
  - Signed upload URLs for direct-to-storage uploads
  - Scheduled tasks: chat archival (24h), rejected song cleanup (48h)
  - Algorithm transparency logging (`play_decision_log` table)
  - Structured logging with Winston
  - Request ID tracing and Sentry error reporting
  
- **Database**: Supabase (PostgreSQL)
  - User profiles and authentication data
  - Song metadata and play history
  - Credit transactions (subscriptions planned)
  - Rotation queue management
  
- **Storage**: Supabase Storage
  - Audio file storage (`songs` bucket)
  - Album artwork storage (`artwork` bucket)
  - Direct client uploads via signed URLs
  
- **Authentication**: Firebase Authentication
  - Email/password authentication
  - Google Sign-In
  - Apple Sign-In
  - Token-based API security
  - Server-side session cookies for web SSR
  
- **Payments**: Stripe
  - PaymentIntent flow for mobile (native UI)
  - Checkout Sessions flow for web (hosted UI)
  - Webhook handling for payment events and Creator Network subscriptions
  - Creator Network subscription (Stripe Price ID, checkout + webhook: `checkout.session.completed`, `customer.subscription.updated/deleted`)
  
- **Admin Dashboard**: Next.js (legacy) + unified admin in web app
  - Song moderation with Approve, Reject, Delete (permanent delete from DB + storage)
  - Sort songs by title, artist name, status, or date
  - User management with role dropdown and lifetime ban / deactivate (removes user data, keeps record to block re-registration)
  - Fallback playlist: upload songs or add from free-rotation song database
  - Legacy admin remains functional; new features live in `web/` dashboard

- **Observability**
  - Winston structured logging (JSON in production)
  - Request ID middleware for distributed tracing
  - Sentry integration for error reporting

## Project Structure

### Root Directory

```
RadioApp/
├── mobile/              # Flutter mobile application
├── backend/             # NestJS backend API
├── web/                 # Next.js web application (NEW)
├── admin/               # Next.js admin dashboard (legacy)
├── docs/                # Project documentation
├── README.md            # This file
└── SETUP.md             # Quick setup guide
```

### Mobile App Structure (`mobile/`)

```
mobile/
├── lib/
│   ├── core/
│   │   ├── auth/
│   │   │   └── auth_service.dart      # Firebase auth service
│   │   ├── models/
│   │   │   ├── user.dart               # User data model
│   │   │   └── song.dart               # Song data model
│   │   └── services/
│   │       ├── api_service.dart        # HTTP API client
│   │       └── radio_service.dart      # Radio streaming + like functionality
│   ├── features/
│   │   ├── player/
│   │   │   └── player_screen.dart      # Radio player with like button
│   │   ├── upload/
│   │   │   └── upload_screen.dart      # Song upload interface
│   │   ├── profile/
│   │   │   └── profile_screen.dart     # User profile management
│   │   ├── credits/
│   │   │   └── credits_screen.dart     # Credit balance & transaction history
│   │   └── payment/
│   │       └── payment_screen.dart     # Stripe Payment Sheet integration
│   ├── widgets/
│   │   ├── login_screen.dart           # Authentication UI
│   │   └── home_screen.dart            # Bottom navigation controller
│   ├── firebase_options.dart           # Firebase configuration
│   └── main.dart                       # App entry point with Stripe init
├── android/                             # Android platform files
├── ios/                                 # iOS platform files
├── pubspec.yaml                         # Flutter dependencies
└── FIREBASE_SETUP.md                    # Firebase setup guide
```

### Web App Structure (`web/`)

```
web/
├── src/
│   ├── app/
│   │   ├── (marketing)/                # Public marketing pages (SSR/ISR)
│   │   │   ├── page.tsx                # Homepage with featured artists
│   │   │   ├── about/page.tsx          # About page
│   │   │   ├── pricing/page.tsx        # Pricing information
│   │   │   ├── faq/page.tsx            # FAQ page
│   │   │   ├── contact/page.tsx        # Contact form
│   │   │   └── layout.tsx              # Marketing layout with header/footer
│   │   ├── (auth)/                     # Authentication pages
│   │   │   ├── login/page.tsx          # Login (email/Google)
│   │   │   ├── signup/page.tsx         # Registration with role selection
│   │   │   └── layout.tsx              # Auth layout
│   │   ├── (dashboard)/                # Authenticated app pages
│   │   │   ├── dashboard/page.tsx      # Role-aware dashboard
│   │   │   ├── listen/page.tsx         # Radio player
│   │   │   ├── profile/page.tsx        # User profile + Creator Network upgrade
│   │   │   ├── notifications/page.tsx  # Notification center
│   │   │   ├── discover/page.tsx      # Discover providers/artists (filters, search)
│   │   │   ├── messages/page.tsx       # DMs (conversations, thread, paywall CTA)
│   │   │   ├── job-board/page.tsx      # Service requests + apply / My requests + applications
│   │   │   ├── competition/page.tsx   # Leaderboards (likes/plays), spotlight, vote Top 7
│   │   │   ├── artist/
│   │   │   │   ├── songs/page.tsx      # My Songs (manage uploads)
│   │   │   │   ├── songs/[id]/allocate/page.tsx  # Credit allocation
│   │   │   │   ├── upload/page.tsx     # Song upload (signed URLs)
│   │   │   │   ├── credits/page.tsx    # Credit Bank & Stripe Checkout
│   │   │   │   └── stats/page.tsx      # Artist analytics
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx            # Admin dashboard
│   │   │   │   ├── songs/page.tsx      # Song moderation (approve, reject, delete)
│   │   │   │   ├── users/page.tsx      # User management (role, lifetime ban)
│   │   │   │   ├── fallback/page.tsx   # Fallback playlist management
│   │   │   │   ├── fallback/upload/page.tsx    # Admin song upload
│   │   │   │   ├── fallback/song-database/page.tsx  # Add from free rotation
│   │   │   │   └── free-rotation/page.tsx  # Free rotation search & toggle
│   │   │   └── layout.tsx              # Dashboard layout with sidebar + notification bell
│   │   ├── api/auth/
│   │   │   ├── login/route.ts          # Session cookie creation
│   │   │   └── logout/route.ts         # Session cookie destruction
│   │   └── layout.tsx                  # Root layout with AuthProvider
│   ├── components/
│   │   ├── ui/                         # shadcn/ui components
│   │   ├── auth/RoleSelectionModal.tsx
│   │   ├── chat/ChatSidebar.tsx
│   │   └── radio/
│   │       ├── RadioPlayer.tsx         # Web radio player component
│   │       └── useRadioState.ts        # Audio state hook (Hls.js)
│   ├── contexts/
│   │   └── AuthContext.tsx             # Firebase auth state management
│   ├── lib/
│   │   ├── api.ts                      # Axios client with token interceptor
│   │   ├── firebase-client.ts          # Firebase client SDK
│   │   └── firebase-admin.ts           # Firebase Admin SDK (for API routes)
│   └── middleware.ts                   # Route protection middleware
├── .env.local.example                   # Environment template
├── package.json                         # Next.js dependencies
└── tsconfig.json                        # TypeScript with shared types path
```

**Key Features:**
- **Marketing Pages**: SSR/ISR for SEO with dynamic featured artists
- **Session Cookies**: HTTP-only cookies for SSR authentication
- **Token Interceptor**: Automatic ID token refresh for API calls
- **Hls.js Player**: Web-optimized audio streaming
- **Signed Uploads**: Direct-to-Supabase file uploads
- **Stripe Checkout**: Web-optimized payment flow

### Backend Structure (`backend/`)

```
backend/
├── src/
│   ├── auth/
│   │   ├── decorators/
│   │   │   ├── user.decorator.ts       # @User() decorator for controllers
│   │   │   └── roles.decorator.ts      # @Roles() decorator for RBAC
│   │   ├── guards/
│   │   │   ├── firebase-auth.guard.ts  # Firebase token verification
│   │   │   └── roles.guard.ts          # Role-based access control
│   │   ├── auth.controller.ts          # Auth endpoints
│   │   └── auth.module.ts              # Auth module definition
│   ├── common/                          # NEW: Observability infrastructure
│   │   ├── logger/
│   │   │   ├── logger.service.ts       # Winston structured logging
│   │   │   └── logger.module.ts        # Global logger module
│   │   ├── middleware/
│   │   │   └── request-id.middleware.ts # Request ID generation & tracing
│   │   ├── sentry/
│   │   │   ├── sentry.service.ts       # Sentry error reporting
│   │   │   └── sentry.module.ts        # Global Sentry module
│   │   └── filters/
│   │       └── all-exceptions.filter.ts # Global exception handler
│   ├── config/
│   │   ├── config.module.ts            # Environment configuration
│   │   ├── firebase.config.ts          # Firebase Admin SDK setup
│   │   └── supabase.config.ts          # Supabase client setup
│   ├── users/
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts      # User creation DTO
│   │   │   └── update-user.dto.ts      # User update DTO
│   │   ├── users.controller.ts         # User CRUD endpoints
│   │   ├── users.service.ts            # User business logic
│   │   └── users.module.ts             # Users module definition
│   ├── songs/
│   │   ├── dto/
│   │   │   ├── create-song.dto.ts      # Song creation DTO
│   │   │   └── get-upload-url.dto.ts   # NEW: Signed upload URL DTO
│   │   ├── songs.controller.ts         # Song endpoints (upload, upload-url, list)
│   │   ├── songs.service.ts            # Song business logic
│   │   └── songs.module.ts             # Songs module definition
│   ├── radio/
│   │   ├── radio.controller.ts         # Radio stream endpoints
│   │   ├── radio.service.ts            # Queue management & rotation logic
│   │   ├── radio-state.service.ts      # Redis-backed state management
│   │   └── radio.module.ts             # Radio module definition
│   ├── uploads/
│   │   ├── uploads.service.ts          # File upload + signed URL generation
│   │   └── uploads.module.ts           # Uploads module definition
│   ├── payments/
│   │   ├── dto/
│   │   │   ├── create-payment-intent.dto.ts    # Mobile payment DTO
│   │   │   └── create-checkout-session.dto.ts  # NEW: Web payment DTO
│   │   ├── payments.controller.ts      # Payment endpoints & webhooks
│   │   ├── payments.service.ts         # Payment business logic (dual flows)
│   │   ├── stripe.service.ts           # Stripe API integration
│   │   └── payments.module.ts          # Payments module definition
│   ├── credits/
│   │   ├── dto/
│   │   │   └── allocate-credits.dto.ts   # Credit allocation DTO
│   │   ├── credits.controller.ts         # Credit balance, allocations & transactions
│   │   ├── credits.service.ts            # Credit allocation via PostgreSQL RPC
│   │   └── credits.module.ts             # Credits module definition
│   ├── notifications/
│   │   ├── notification.controller.ts    # Notification endpoints
│   │   ├── notification.service.ts       # In-app notification management
│   │   └── notification.module.ts        # Notifications module definition
│   ├── email/
│   │   ├── email.service.ts              # Email notifications (SendGrid/Resend)
│   │   └── email.module.ts               # Email module definition
│   ├── tasks/
│   │   ├── cleanup.service.ts            # Scheduled cleanup (48hr rejected songs)
│   │   └── tasks.module.ts               # Tasks module with @nestjs/schedule
│   ├── admin/
│   │   ├── dto/
│   │   │   └── update-song-status.dto.ts  # Song approval DTO with rejection reason
│   │   ├── admin.controller.ts         # Admin endpoints (songs, users, analytics, fallback)
│   │   ├── admin.service.ts            # Admin business logic + fallback management
│   │   └── admin.module.ts             # Admin module definition
│   ├── app.module.ts                    # Root module (imports all modules)
│   ├── app.controller.ts                # Health check endpoint
│   ├── app.service.ts                   # App-level services
│   └── main.ts                          # Application entry point
├── .env.example                         # Environment template
├── package.json                          # Node.js dependencies
├── tsconfig.json                         # TypeScript configuration
└── SETUP_BACKEND.md                      # Backend setup guide
```

**Key Components:**
- **Firebase Auth Guard**: Validates Firebase ID tokens, checks ban status, rejects banned users
- **Radio Service**: Soft-weighted random selection, pre-charge model, trial rotation, fallback playlists
- **Radio State Service**: Redis-backed state management for horizontal scaling
- **Uploads Service**: Multipart uploads + signed URL generation + duration validation
- **Duration Service**: Server-side audio duration extraction (music-metadata)
- **Stripe Service**: PaymentIntents (mobile) + Checkout Sessions (web)
- **Songs Service**: Song metadata, like/unlike, play counts, opt-in free play, trial plays
- **Credits Service**: Atomic credit allocation/withdrawal via PostgreSQL RPC
- **Notification Service**: In-app notifications with soft delete for song approval/rejection
- **Push Notification Service**: FCM with debounced "Up Next" (1 per 4hrs) and "Live Now" alerts
- **Email Service**: Email notifications (SendGrid/Resend) with templates
- **Cleanup Service**: Scheduled job to delete rejected songs after 48 hours
- **Admin Service**: Analytics, song moderation, user bans (hard + shadow), free rotation search
- **Analytics Service**: Artist stats, song analytics, platform metrics, play decision audit
- **Logger Service**: Winston-based structured logging with request IDs
- **Sentry Service**: Error capture and reporting
- **AllExceptionsFilter**: Consistent error responses with tracing

### Admin Dashboard Structure (`admin/`) - Legacy

```
admin/
├── app/
│   ├── components/
│   │   ├── AuthGuard.tsx                # Route protection component
│   │   ├── DashboardLayout.tsx          # Conditional sidebar layout
│   │   ├── Sidebar.tsx                  # Navigation with sign out
│   │   └── StatsCard.tsx                # Analytics stat display
│   ├── contexts/
│   │   └── AuthContext.tsx              # Firebase auth state management
│   ├── lib/
│   │   ├── api.ts                       # Backend API client
│   │   └── firebase.ts                  # Firebase initialization
│   ├── login/
│   │   └── page.tsx                     # Login page (email/Google)
│   ├── songs/
│   │   └── page.tsx                     # Song moderation table
│   ├── users/
│   │   └── page.tsx                     # User management table
│   ├── layout.tsx                       # Root layout with providers
│   ├── page.tsx                         # Dashboard with analytics
│   └── globals.css                      # Global styles
├── public/                               # Static assets
├── .env.local.example                    # Environment template
├── package.json                          # Next.js dependencies
├── next.config.ts                        # Next.js configuration
└── tsconfig.json                         # TypeScript configuration
```

> **Note**: Admin functionality is being migrated to the unified `web/` app.

### Documentation (`docs/`)

```
docs/
├── api-spec.md                           # Complete API endpoint documentation
├── database-schema.md                    # Database schema and migrations
├── radio-logic.md                        # Radio track selection, tiers, artist spacing
├── deliverables-verification.md          # README vs codebase verification
└── notion/                               # Notion workspace (project categories, views, onboarding)
    ├── 01-information-architecture.md     # IA and hierarchy
    ├── notion-workspace-created.md        # Workspace setup notes
    ├── notion-workspace-review-project-categories.md   # Project ID (Radio App / NBA ML) review
    └── notion-views-and-onboarding.md    # View setup + onboarding (By Project ID, Uncategorized tasks)
```

### Notion Workspace

Planning and tracking use a **Notion** workspace with **Project ID** (Radio App | NBA ML) on Projects, Tasks, Goals, and App Production. See:

- **Project categories & linking:** `docs/notion/notion-workspace-review-project-categories.md`
- **Views & onboarding:** `docs/notion/notion-views-and-onboarding.md` (App Production “By Project ID”, Tasks “Uncategorized”, Projects “By Project ID” default; onboarding: new doc → set Project ID; new task → set Project/Project ID)

### Additional Documentation Files

- `SETUP.md`: Quick start guide
- `FIREBASE_COMPLETE_SETUP.md`: Comprehensive Firebase setup
- `FIREBASE_QUICK_START.md`: Quick Firebase reference
- `ANDROID_SDK_SETUP.md`: Android development setup
- `WINDOWS_DEVELOPER_MODE.md`: Windows-specific setup
- `QUICK_ANDROID_SDK_FIX.md`: Android SDK troubleshooting

## Setup Instructions

### Prerequisites

- Node.js 22+ and npm
- Flutter SDK 3.38+
- Firebase project
- Supabase project
- Stripe account

### Running with Docker (WSL)

Run the backend and Redis in Docker for local development and mobile testing (no code changes: `backend` already reads `REDIS_URL`; in Compose it is set to `redis://redis:6379`).

1. **Install Docker in WSL** (Debian/Ubuntu). From a WSL terminal:
   ```bash
   sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   sudo chmod a+r /etc/apt/keyrings/docker.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   sudo service docker start
   ```
   Optional: `sudo usermod -aG docker $USER` then log out and back in to run Docker without `sudo`. Alternatively, use Docker Desktop for Windows with “Use WSL 2 based engine” and use `docker` / `docker compose` from WSL.

2. **Create `.env` at repo root** (Compose uses `env_file: .env`). Copy from `.env.example` and fill in Supabase, Stripe, etc. For Firebase: keep the service account JSON in your home directory (e.g. `firebase-service-account.json`); it is gitignored. Set `FIREBASE_SERVICE_ACCOUNT_PATH` to that path for local runs, and `FIREBASE_JSON_PATH` to the same path for Docker (WSL: `/mnt/c/Users/.../firebase-service-account.json`) so the file is mounted into the container.
   ```bash
   cp .env.example .env
   # Edit .env: SUPABASE_SERVICE_KEY, STRIPE_*, FIREBASE_JSON_PATH; never commit .env
   ```

3. **Start backend + Redis** from the repo root in WSL:
   ```bash
   cd /path/to/RadioApp   # e.g. /mnt/c/Users/tmaku/OneDrive/Documents/GSU/Projects/RadioApp
   docker compose up -d redis backend
   # Or build and run: docker compose up --build -d
   ```
   Backend: **http://localhost:3000**. Redis: port 6379. Check logs: `docker compose logs -f backend`; you should see “Redis client connected”.

4. **Mobile app (Android)** — point the app at the backend:
   - **Android emulator**: In `mobile/.env` set `API_BASE_URL=http://10.0.2.2:3000` (emulator’s alias to host).
   - **Physical device on same LAN**: Use the host machine’s IP, e.g. `API_BASE_URL=http://192.168.1.x:3000`.
   Run the app on the host: `cd mobile && flutter pub get && flutter run` (select Android). The app is not run inside Docker.

5. **iOS**: Simulator requires macOS (Xcode). On Windows-only use cloud macOS (e.g. GitHub Actions `macos-latest`) or a device cloud (Firebase Test Lab, BrowserStack, etc.).

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Create `.env` file (copy from `.env.example`):
```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Server Configuration
PORT=3000
NODE_ENV=development
WEB_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Redis Configuration (Optional - for scaling)
REDIS_URL=redis://localhost:6379

# Error Tracking (Optional)
SENTRY_DSN=https://your-key@sentry.io/your-project

# Email Configuration (Optional - logs to console if not set)
EMAIL_PROVIDER=sendgrid  # or 'resend'
EMAIL_FROM=noreply@radioapp.com
SENDGRID_API_KEY=SG.xxxxx  # if using SendGrid
RESEND_API_KEY=re_xxxxx    # if using Resend
```

4. Run database migrations (execute SQL from `docs/database-schema.md` in Supabase SQL editor)

5. Create storage buckets in Supabase:
   - `songs` - for audio files
   - `artwork` - for album artwork

6. **(Optional) Activate Redis** for radio state, listener count, and emoji aggregation:
   - Start Redis (e.g. Docker): `docker run -d --name radioapp-redis -p 6379:6379 redis:7-alpine`
   - In `backend/.env`, set `REDIS_URL=redis://localhost:6379` (or leave unset to use that default).
   - Restart the backend; logs will show "RadioStateService using Redis for state management" when connected.

7. **Running with Docker (WSL)** — Backend + Redis in one stack (see [Running with Docker (WSL)](#running-with-docker-wsl) above).

8. Start the server:
```bash
npm run start:dev
```

### Web App Setup

1. Navigate to web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file (copy from `.env.local.example`):
```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Firebase Configuration (Client SDK)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin SDK (for API routes)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# Web URL
NEXT_PUBLIC_WEB_URL=http://localhost:3001
```

4. Start the development server:
```bash
npm run dev
```

5. Access the web app at `http://localhost:3001`

### Mobile App Setup

1. Navigate to mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
flutter pub get
```

3. Add Firebase configuration:
   - Add `google-services.json` (Android) to `android/app/`
   - Add `GoogleService-Info.plist` (iOS) to `ios/Runner/`

4. Create `.env` file:
```bash
FIREBASE_API_KEY=your-api-key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
API_BASE_URL=http://localhost:3000
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```
   For **Android emulator** with the backend running in Docker (or on host), use `API_BASE_URL=http://10.0.2.2:3000`. For a **physical device** on the same LAN, use your machine’s IP (e.g. `http://192.168.1.x:3000`).

5. Run the app:
```bash
flutter run
```

### Admin Dashboard Setup (Legacy)

1. Navigate to admin directory:
```bash
cd admin
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file (copy from `.env.local.example`)

4. Start the development server:
```bash
npm run dev
```

5. Access the dashboard at `http://localhost:3002` (or configure different port)

## How It Works

### User Flow

1. **Artist Registration & Upload**
   - Artist signs up via Firebase Authentication (email, Google, or Apple)
   - Backend creates user profile in Supabase
   - Artist uploads song file and artwork
   - **Web**: Uses signed URLs for direct-to-Supabase uploads
   - **Mobile**: Uses multipart upload through backend
   - Song metadata is saved to PostgreSQL database

2. **Credit Purchase**
   - Artist navigates to payment screen
   - **Mobile**: Stripe Payment Sheet (native UI)
   - **Web**: Stripe Checkout Session (hosted UI)
   - Stripe webhook confirms payment completion
   - Credits are added to artist's account

3. **Radio Playback**
   - Song is added to rotation queue when credits are available
   - Queue is stored in database (persists across server restarts)
   - Priority scoring based on likes, skips, and engagement
   - **Mobile**: Audio stream via `just_audio`
   - **Web**: Audio stream via Hls.js
   - Play history recorded; like/unlike updates engagement metrics

4. **Listener Experience**
   - Listener opens app/website and authenticates
   - Continuous stream plays songs from rotation queue
   - Songs play automatically in sequence
   - No user-initiated skipping in UI (skip events tracked for analytics)
   - Like/unlike songs to influence future rotation

5. **Admin Workflow**
   - Admin signs into dashboard with Firebase
   - Backend verifies admin role from database
   - View platform analytics (total users, songs, plays, likes)
   - Review and approve/reject pending song submissions
   - Manage user roles (promote to artist/admin)

### Data Flow

```
Mobile App (Flutter) / Web App (Next.js)
    ↓ (HTTP + Firebase Token)
Backend API (NestJS)
    ↓ (Supabase Client)
PostgreSQL Database (Supabase)
    ↓ (Storage API)
Supabase Storage (Audio Files)
```

### Authentication Flow

**Mobile:**
```
1. User authenticates → Firebase Auth
2. Receives Firebase ID Token
3. Token sent with API requests → Backend
4. Backend verifies token → Firebase Admin SDK
5. User info extracted → Supabase user lookup
6. Protected routes accessible
```

**Web (Session Cookies for SSR):**
```
1. User authenticates → Firebase Auth (client)
2. ID token sent to /api/auth/login
3. Server verifies token → Creates HTTP-only session cookie
4. Cookie used for SSR personalization
5. Fresh ID token fetched for API calls (interceptor)
6. Protected routes accessible
```

### Payment Flow

**Mobile (PaymentIntent):**
```
1. Artist selects credit package → Credits Screen
2. Payment intent created → POST /payments/create-intent
3. Stripe Payment Sheet presented → flutter_stripe
4. User completes payment → Stripe processes
5. Webhook received → payment_intent.succeeded
6. Credits added → Supabase database
```

**Web (Checkout Session):**
```
1. Artist selects credit package → Credits Page
2. Checkout session created → POST /payments/create-checkout-session
3. User redirected to Stripe Checkout
4. User completes payment → Stripe processes
5. Webhook received → checkout.session.completed
6. Credits added → Supabase database
7. User redirected back with success
```

## Features Implemented

### Authentication & User Management
- ✅ Firebase Authentication (Email/Password, Google, Apple Sign-In)
- ✅ User profile creation and management
- ✅ Role-based access control (Artist, Listener, Admin)
- ✅ Secure token-based API authentication
- ✅ HTTP-only session cookies for web SSR
- ✅ Token refresh interceptor for API calls

### Music Management
- ✅ Song upload with metadata (title, artist, genre, duration)
- ✅ Album artwork upload and display
- ✅ **Signed upload URLs** for direct-to-storage uploads (web)
- ✅ **Duration extraction/validation**: server-side for multipart uploads; for signed uploads the web client captures duration and the backend can validate/extract as available
- ✅ Song listing and search
- ✅ Play history tracking
- ✅ Like/unlike songs functionality
- ✅ Song approval workflow with rejection reasons
- ✅ **Opt-in free play** for songs without credits
- ✅ **48-hour cleanup** of rejected songs (scheduled task)

### Radio Streaming
- ✅ **True Radio Sync**: All clients synchronized to server time with position tracking
- ✅ **Soft Pause (DVR buffer)**: 30-second pause buffer, "Jump to Live" after expiry
- ✅ **LIVE indicator**: Animated indicator when synced to live stream
- ✅ Continuous radio stream playback with auto-advance
- ✅ **Deterministic shuffle**: Seeded random for reproducible playlist order
- ✅ **Soft-weighted random selection** (slight preference for more credits/less recent plays)
- ✅ **Pre-charge model** with atomic PostgreSQL RPC transactions
- ✅ **Trial rotation**: New approved songs get 3 free plays before requiring credits
- ✅ **Four-tier fallback**: credited songs → trial songs → opt-in songs → admin fallback
- ✅ **Artist spacing**: Free rotation refill uses round-robin by artist; paid/trial/opt-in deprioritize the artist that just played (no same-artist back-to-back)
- ✅ **Free rotation eligibility**: Requires artist opt-in + admin approval (paid play check temporarily disabled)
- ✅ **Algorithm transparency**: `play_decision_log` table for auditing song selection
- ✅ **Redis state management**: Stateless backend for horizontal scaling
- ✅ Queue preview endpoint
- ✅ Audio streaming via Supabase Storage URLs
- ✅ **Hls.js web player** with custom React hook

### Credit System
- ✅ **Credit Bank model**: Buy credits → allocate to individual songs
- ✅ **Atomic transactions** via PostgreSQL RPC functions
- ✅ **Credit allocation** to songs with minute bundles
- ✅ **Credit withdrawal** from songs back to bank
- ✅ **Per-play cost calculation** (1 credit = 5 seconds airtime)
- ✅ Allocation history tracking

### Payment System
- ✅ Stripe payment integration
- ✅ **Dual payment flows**: PaymentIntent (mobile) + Checkout Sessions (web)
- ✅ Credit purchase system with package selection
- ✅ Webhook handling for both payment types
- ✅ Transaction history with status badges

### Notifications
- ✅ **In-app notifications** for song approval/rejection
- ✅ **Email notifications** (SendGrid/Resend integration)
- ✅ **Push notifications**: "Up Next" (T-60s) and "Live Now" with 4-hour debounce per artist
- ✅ **Notification bell** with unread count (styled as button)
- ✅ Mark as read / Mark all as read
- ✅ **Soft delete**: Delete single or all notifications (audit trail preserved)

### Chat Features
- ✅ **Real-time messaging** with Supabase Realtime
- ✅ **Emoji reactions** with Redis aggregation (8 allowed emojis)
- ✅ **Chat moderation**: Kill switch, shadow ban, and message deletion
- ✅ **Chat archival**: 24-hour cleanup to cold storage
- ✅ **Connection indicators** and smart scroll behavior

### Mobile App Features
- ✅ **Bottom navigation bar** (Player, Upload, Credits, Profile)
- ✅ **Like button** on player screen
- ✅ **Credits screen** with balance and transaction history
- ✅ Stripe Payment Sheet integration
- ✅ Role-based navigation
- ✅ **WebView bridge** to web dashboard for credit management

### Web App Features
- ✅ **Marketing pages** (Homepage with real platform stats, About, Pricing, FAQ, Contact)
- ✅ **SSR/ISR** for SEO optimization with 60-second revalidation
- ✅ **Session cookie authentication** for SSR
- ✅ **Role-aware dashboard** with sidebar navigation
- ✅ **Web radio player** with Hls.js, LIVE indicator, soft pause, and "Jump to Live"
- ✅ **Artist upload page** with signed URLs
- ✅ **Credit Bank page** with Stripe Checkout and allocation link
- ✅ **My Songs page** with status, duration, credits, trial plays, and actions
- ✅ **Credit allocation page** with minute bundles and opt-in toggle
- ✅ **Notifications page** with unread indicator and delete functionality
- ✅ **Artist analytics** (plays, credits, engagement, daily breakdown, Top Performing Songs from real API)
- ✅ **Discover** (providers/artists with service type, location, search; link to profile and Messages)
- ✅ **Messages** (conversations, thread view, send DM; Creator Network paywall with upgrade CTA)
- ✅ **Job board** (browse/open service requests, apply with message; artists see applications per request)
- ✅ **Creator Network** (Profile: subscribe via Stripe; DMs gated; webhook syncs subscription status)
- ✅ **Competition** (leaderboards by likes and by plays with actual stats; spotlight, vote Top 7)
- ✅ **Admin dashboard** (analytics, song moderation with status transitions)
- ✅ **Admin user management** with hard ban and shadow ban controls
- ✅ **Admin fallback playlist** management page
- ✅ **Admin free rotation search** with eligibility indicators and toggle

### Observability & Infrastructure
- ✅ RESTful API architecture under `/api`
- ✅ **Structured logging** with Winston (JSON in production)
- ✅ **Request ID middleware** for distributed tracing
- ✅ **Sentry integration** for error reporting
- ✅ **Global exception filter** with consistent error responses
- ✅ **Redis integration** for stateless scaling (radio state, emoji aggregation, listener counts)
- ✅ File upload handling (multipart/form-data + signed URLs)
- ✅ CORS configuration
- ✅ Environment-based configuration
- ✅ Global ValidationPipe for DTO validation
- ✅ **Algorithm audit trail** via `play_decision_log` table

## Development Workflow

### Running the Full Stack

1. **Start Backend** (Terminal 1):
   ```bash
   cd backend
   npm run start:dev
   ```
   Backend runs on `http://localhost:3000`

2. **Start Web App** (Terminal 2):
   ```bash
   cd web
   npm run dev
   ```
   Web app runs on `http://localhost:3001`

3. **Start Mobile App** (Terminal 3):
   ```bash
   cd mobile
   flutter run
   ```
   App runs on connected device/emulator

### Testing

- **Backend**: Unit tests with Jest (`npm test` in `backend/`)
- **Mobile**: Widget tests (`flutter test` in `mobile/`)
- **Web**: Next.js tests (`npm test` in `web/`)
- **API**: Use Postman or similar tool with Firebase token for authenticated endpoints

### Environment Variables

Each component requires specific environment variables:

- **Backend**: See `backend/.env.example`
- **Web**: See `web/.env.local.example`
- **Mobile**: See `mobile/.env` (create from template)
- **Admin**: See `admin/.env.local.example`

### Common Development Tasks

- **Adding a new API endpoint**: Create controller, service, and module in `backend/src/`
- **Adding a new web page**: Create page in `web/src/app/`
- **Adding a new mobile screen**: Create feature folder in `mobile/lib/features/`
- **Database changes**: Update `docs/database-schema.md` and run migrations in Supabase
- **Firebase changes**: Regenerate `firebase_options.dart` with FlutterFire CLI

## Temporarily Disabled Features

The following features have been temporarily disabled for development/testing purposes and are planned for future implementation:

### Paid Play Requirement for Free Rotation

**Status**: Commented out (easy to restore)

**Original behavior**: Songs must have at least 1 paid play (`paid_play_count > 0`) before they can be added to free rotation. This ensures artists "invest" in the platform before getting free airplay.

**Current behavior**: Songs can be added to free rotation without any paid plays. Only requires:
- Artist opt-in (`opt_in_free_play = true`)
- Admin approval (`admin_free_rotation = true`)

**Files affected**:
- `backend/src/admin/admin.service.ts` - Eligibility checks and toggle validation
- `backend/src/radio/radio.service.ts` - `getOptInSong()` query filter

**To restore**: Search for `DISABLED: Paid play requirement` in the backend codebase and uncomment the relevant lines.

## Planned Implementation

The platform is evolving into an **online music popularity competition** (freshman-cypher style) with community artist engagement and later live shows/events. Planned features (in implementation):

- **Competition/spotlight as first page after login** — Leaderboards (by likes and by listens), featured artists, voting (Top 7, rank 1–7), news and promotions, and dynamic shifting/moving UI (shadcn, Supabase, Firebase).
- **Unlimited listening** — Featured song on artist page (unlimited replays); Artist of the Week (all music for that week); Artist of the Month (all music for next month); listens counted for a separate listens leaderboard.
- **Location** — “Artists in your area” (country + optional region/city) with user preference toggle.
- **Week → Month → Year** — Weekly vote, Artist of the Week, monthly/yearly winners and prizes.
- **Artist bios** — Bio section on artist (and provider) pages; editable in profile/settings.
- **Admin live broadcast** — Go live during the stream from the admin dashboard; stream switches to live feed.
- **Live services** — Artists promote performances/sessions; listeners follow artists and see upcoming live services.
- **Service providers** — Distinct user type with own dashboard; bio and portfolio (audio/visual); artists get a Services tab to search/filter by service type and location, send messages, and post requests; marketplace with listings and orders (payments later).

**Full plan:** [docs/planned-implementation-competition.md](docs/planned-implementation-competition.md)

## Troubleshooting

### Backend Issues

- **Firebase private key parsing error**: Ensure `FIREBASE_PRIVATE_KEY` has `\n` characters properly escaped
- **Supabase connection error**: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
- **Stripe webhook errors**: Ensure `STRIPE_WEBHOOK_SECRET` matches your Stripe webhook configuration

### Web App Issues

- **Session cookie not set**: Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is valid JSON in `.env.local`
- **401 errors on API calls**: Token interceptor should refresh automatically; check browser console
- **Hls.js errors**: Ensure audio files are in supported format (HLS/MP3)

### Mobile App Issues

- **Blank screen on launch**: Check Firebase initialization in `main.dart`
- **"No Firebase App '[DEFAULT]' has been created"**: Ensure Firebase is properly configured
- **Build errors**: Run `flutter clean` and `flutter pub get`

### General Issues

- **CORS errors**: Update `CORS_ORIGIN` in backend `.env` to include all frontend URLs
- **Port conflicts**: Change ports in respective `.env` files

For more detailed troubleshooting, see:
- `mobile/TROUBLESHOOTING.md`
- `backend/SETUP_BACKEND.md`
- `WINDOWS_DEVELOPER_MODE.md` (Windows-specific)

## API Documentation

See `docs/api-spec.md` for detailed API endpoint documentation, request/response formats, and authentication requirements.

**Radio logic:** See `docs/radio-logic.md` for how the backend chooses and orders tracks (free vs paid mode, four-tier selection, artist spacing, soft-weighted random, and free-rotation stack refill).

### Key Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/radio/current` | GET | No | Get current playing track with position |
| `/api/songs/upload-url` | POST | Artist | Get signed upload URL |
| `/api/payments/create-intent` | POST | Artist | Create PaymentIntent (mobile) |
| `/api/payments/create-checkout-session` | POST | Artist | Create Checkout Session (web) |
| `/api/analytics/me` | GET | Artist | Get artist analytics |
| `/api/analytics/platform` | GET | No | Get platform-wide statistics |
| `/api/discovery/people` | GET | User | List providers/artists (filters, search) |
| `/api/creator-network/access` | GET | User | Check Creator Network subscription |
| `/api/messages/conversations` | GET | User | List DM conversations |
| `/api/messages/conversations/:id` | GET/POST | User | Thread + send message (paywall) |
| `/api/job-board/requests` | GET | User | List service requests (optional ?mine=true) |
| `/api/job-board/requests/:id/applications` | GET/POST | User | Applications (artist: list; provider: apply) |
| `/api/payments/create-creator-network-checkout-session` | POST | User | Create Creator Network subscription checkout |
| `/api/notifications` | DELETE | User | Soft delete notifications |
| `/api/admin/songs/:id` | PATCH | Admin | Update song status (pending/approved/rejected) |
| `/api/admin/users/:id/hard-ban` | POST | Admin | Hard ban with token revocation |
| `/api/admin/users/:id/shadow-ban` | POST | Admin | Shadow ban for chat trolls |
| `/api/admin/free-rotation/*` | GET/PATCH | Admin | Free rotation search and toggle |

## Database Schema

See `docs/database-schema.md` for complete database schema, table definitions, relationships, and migration SQL scripts.

## Security Best Practices

### Credential Management
- **Never commit secrets**: All `.env` files, Firebase service account JSON files, and API keys are git-ignored
- **Use environment variables**: Store all sensitive data in `.env` files (not in code)
- **Rotate compromised keys**: If credentials are ever exposed, rotate them immediately via the respective console (Firebase, Stripe, Supabase)

### Git-Ignored Sensitive Files
The following are automatically ignored by `.gitignore`:
- `*.env` / `.env.*` (environment variables)
- `**/config/*.json` (Firebase service accounts)
- `google-services.json` (Android Firebase config)
- `GoogleService-Info.plist` (iOS Firebase config)
- `*firebase*admin*.json` (Admin SDK credentials)
- `*service*account*.json` (Service account keys)
- `*private*key*` (Private key files)

### Security Checklist
- [ ] All `.env` files created locally (not from git)
- [ ] Firebase credentials obtained from Firebase Console
- [ ] Stripe keys obtained from Stripe Dashboard
- [ ] No secrets in git history (use `git log -p` to verify)

## Contributing

This is a private project. For internal contributors:

1. Create a feature branch from `main`
2. Make changes and test thoroughly
3. Update documentation as needed
4. Commit with descriptive messages
5. Push and create a pull request

## License

Private project - All rights reserved
