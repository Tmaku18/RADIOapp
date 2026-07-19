# NETWORX System Architecture Diagram

**Product:** NETWORX Radio: The Butterfly Effect  
**Tagline:** By artists, for artists.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENTS                                          │
├─────────────────────────────┬───────────────────────────┬───────────────────────────┤
│         WEB (Next.js)       │     MOBILE (Flutter)      │      ADMIN (Next.js)      │
│    • Listen/Stage page      │   • Player screen         │   • Song moderation       │
│    • Competition/Leaderboard│   • Leaderboards          │   • User management       │
│    • Artist profile         │   • Artist profile        │   • Radio queue control   │
│    • Analytics (The Wake)   │   • Analytics             │   • Fallback playlist     │
│    • Yield/Rewards          │   • Yield/Rewards         │   • Free rotation         │
│    • Pro-Directory          │   • Pro-Directory         │   • Artist live mod       │
│    • Live chat              │   • Live chat             │                           │
│    • Payments (Checkout)    │   • Payments (Sheet)      │                           │
│    • Artist livestream      │   • Artist livestream     │                           │
└─────────────────────────────┴───────────────────────────┴───────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (NestJS)                                       │
│                           http://localhost:3000/api                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  MODULES:                                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │    Radio     │ │    Songs     │ │   Credits    │ │  Leaderboard │               │
│  │  • /current  │ │  • upload    │ │  • balance   │ │  • by likes  │               │
│  │  • /next     │ │  • approve   │ │  • allocate  │ │  • listens   │               │
│  │  • /heartbeat│ │  • reject    │ │  • history   │ │  • +votes    │               │
│  │  • /play     │ │  • like      │ │              │ │  • ratio     │               │
│  │  • temp cache│ │  • library   │ │              │ │  • saves     │               │
│  │              │ │              │ │              │ │  • trial/fire│               │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │   Payments   │ │  Prospector  │ │   Refinery   │ │  Analytics   │               │
│  │  • checkout  │ │  • yield     │ │  • list      │ │  • /me       │               │
│  │  • intent    │ │  • check-in  │ │  • add/remove│ │  • /roi      │               │
│  │  • webhook   │ │  • refinement│ │  • comments  │ │  • /region   │               │
│  │  • quick-add*│ │  • redeem    │ │  • rank      │ │              │               │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │ Artist Live  │ │   Discovery  │ │   Messages   │ │    Admin     │               │
│  │  • start/stop│ │  • people    │ │  • threads   │ │  • songs     │               │
│  │  • streamer- │ │  • nearby    │ │  • send      │ │  • users     │               │
│  │    status    │ │  • providers │ │  • job-board │ │  • streamer- │               │
│  │  • apply     │ │              │ │              │ │    apps      │               │
│  │  • watch     │ │              │ │              │ │  • fallback  │               │
│  │  • donations │ │              │ │              │ │  • radio     │               │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │    Users     │ │     Chat     │ │  Venue Ads   │ │ Notifications│               │
│  │  • /me       │ │  • realtime  │ │  • /current  │ │  • FCM push  │               │
│  │  • profile   │ │  • archival  │ │              │ │  • in-app    │               │
│  │  • upgrade   │ │  • emoji     │ │              │ │              │               │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
           ┌─────────────────────────────┼─────────────────────────────┐
           ▼                             ▼                             ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│       REDIS         │    │      SUPABASE       │    │      FIREBASE       │
│  (State & Cache)    │    │   (DB + Storage)    │    │   (Auth + Push)     │
├─────────────────────┤    ├─────────────────────┤    ├─────────────────────┤
│ • Radio state       │    │ PostgreSQL:         │    │ • Authentication    │
│ • Current track     │    │  • users            │    │   - Email/password  │
│ • Next track        │    │  • songs            │    │   - Google OAuth    │
│ • Listener count    │    │  • plays            │    │   - Apple Sign-In   │
│ • Emoji aggregation │    │  • likes            │    │ • FCM Push          │
│ • Session state     │    │  • credits          │    │   - Up Next         │
│                     │    │  • transactions     │    │   - Live Now        │
│                     │    │  • yield            │    │   - Artist Live     │
│                     │    │  • refinery         │    │ • Admin SDK         │
│                     │    │  • artist_live      │    │   - Token verify    │
│                     │    │  • messages         │    │   - Token revoke    │
│                     │    │  • notifications    │    │                     │
│                     │    │  • leaderboard_likes│    │                     │
│                     │    │  • song_temperature │    │                     │
│                     │    │  • play_decision_log│    │                     │
│                     │    ├─────────────────────┤    │                     │
│                     │    │ Realtime:           │    │                     │
│                     │    │  • Live chat        │    │                     │
│                     │    │  • Ripple events    │    │                     │
│                     │    │  • Like broadcasts  │    │                     │
│                     │    ├─────────────────────┤    │                     │
│                     │    │ Storage:            │    │                     │
│                     │    │  • Song audio files │    │                     │
│                     │    │  • Artwork images   │    │                     │
│                     │    │  • User avatars     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                         │
                                         ▼
                           ┌─────────────────────┐
                           │       STRIPE        │
                           │    (Payments)       │
                           ├─────────────────────┤
                           │ • Credit purchases  │
                           │ • Song play packs   │
                           │ • Quick-add minutes*│
                           │ • Creator Network   │
                           │   subscription      │
                           │ • Stream donations  │
                           │ • Webhooks          │
                           └─────────────────────┘
```

`*` **Quick-add minutes:** `POST /payments/quick-add-minutes` remains available for surfaces that wire it (e.g. some **pro-web** radio UIs). It is **not** exposed on the main **Engine / Stage** listen experience (web + mobile).

---

## Feature Matrix: Web vs Mobile

```
┌────────────────────────────────────┬─────────┬─────────┐
│            FEATURE                 │   WEB   │ MOBILE  │
├────────────────────────────────────┼─────────┼─────────┤
│ LIVE RADIO & PLAYBACK              │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Synchronized radio                 │    ✅   │    ✅   │
│ Continuous playback                │    ✅   │    ✅   │
│ Radio controls (play/pause/volume) │    ✅   │    ✅   │
│ Background playback                │    ✅   │    ✅   │
│ Heartbeat (proof-of-listening)     │    ✅   │    ✅   │
│ Play reporting                     │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ ARTIST CONTENT                     │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Song upload                        │    ✅   │    ✅   │
│ Moderation workflow                │    ✅   │    —    │
│ Paid rotation (credits)            │    ✅   │    ✅   │
│ Artist discography                 │    ✅   │    ✅   │
│ Live services (promote + support)  │    ✅   │    ✅   │
│ Profile listens                    │    ✅   │    —    │
├────────────────────────────────────┼─────────┼─────────┤
│ ENGAGEMENT & RIPPLES               │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Ripples (persistent likes)         │    ✅   │    ✅   │
│ Radio votes fire/shit (per play)   │    ✅   │    ✅   │
│ Song temperature on now-playing      │    ✅   │    ✅   │
│ Vote once per play (radio)         │    ✅   │    ✅   │
│ Realtime Ripple visuals            │    ✅   │    —    │
│ Rising Star / Butterfly Ripple     │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ COMPETITION & LEADERBOARDS         │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ By Ripples                         │    ✅   │    ✅   │
│ By discoveries (listens)           │    ✅   │    ✅   │
│ By positive votes / ratio / saves  │    ✅   │    ✅   │
│ Trial by Fire                      │    ✅   │    ✅   │
│ Spotlight / Top 7                  │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ LIVE CHAT & SOCIAL                 │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Live radio chat                    │    ✅   │    ✅   │
│ Emoji reactions                    │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ ARTIST LIVESTREAM                  │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Go live / Stop live                │    ✅   │    ✅   │
│ Watch live                         │    ✅   │    ✅   │
│ Stream donations                   │    ✅   │    ✅   │
│ Stream moderation                  │    ✅   │    —    │
│ Radio player live link             │    ✅   │    —    │
├────────────────────────────────────┼─────────┼─────────┤
│ NOTIFICATIONS                      │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Up Next / Live Now (push)          │    —    │    ✅   │
│ In-app notifications               │    ✅   │    ✅   │
│ Creator Network events             │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ THE YIELD (PROSPECTOR REWARDS)     │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Yield balance                      │    ✅   │    ✅   │
│ Check-in                           │    ✅   │    ✅   │
│ Refinement                         │    ✅   │    ✅   │
│ Survey                             │    ✅   │    ✅   │
│ Redemption ($5/$10 Visa)           │    ✅   │    ✅   │
│ Rewards Command Center             │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ THE REFINERY                       │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ List Refinery songs                │    ✅   │    ✅   │
│ Add/remove from Refinery           │    ✅   │    ✅   │
│ Rank (1–10)                        │    ✅   │    ✅   │
│ Comments                           │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ CREDITS & PAYMENTS                 │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Credit balance                     │    ✅   │    ✅   │
│ Buy credits                        │    ✅   │    ✅   │
│ Allocate credits                   │    ✅   │    ✅   │
│ Buy song plays                     │    ✅   │    ✅   │
│ Quick Add minutes (API; not Engine)│    —    │    —    │
│ Transactions                       │    ✅   │    ✅   │
│ Creator Network subscription       │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ THE WAKE (ANALYTICS)               │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Artist analytics summary           │    ✅   │    ✅   │
│ ROI                                │    ✅   │    ✅   │
│ Listener heatmap (by region)       │    ✅   │    ✅   │
│ Discoverable toggle                │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ DISCOVERY & PRO-DIRECTORY          │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Discover people                    │    ✅   │    ✅   │
│ Nearby (location)                  │    —    │    ✅   │
│ Provider profile                   │    ✅   │    ✅   │
│ Pro-NETWORX directory              │    ✅   │    ✅   │
│ Pro-NETWORX profile                │    ✅   │    ✅   │
│ Pro-NETWORX onboarding             │    ✅   │    —    │
├────────────────────────────────────┼─────────┼─────────┤
│ MESSAGING & CREATOR NETWORK        │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ DMs (conversations)                │    ✅   │    ✅   │
│ Creator Network paywall            │    ✅   │    ✅   │
│ Job board                          │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ VENUE & SPONSORSHIP                │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Venue Partner slot                 │    ✅   │    ✅   │
├────────────────────────────────────┼─────────┼─────────┤
│ ADMIN (web only)                   │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Song moderation                    │    ✅   │    —    │
│ User management                    │    ✅   │    —    │
│ Fallback playlist                  │    ✅   │    —    │
│ Free rotation                      │    ✅   │    —    │
│ Radio queue / override             │    ✅   │    —    │
│ Analytics (platform-wide)          │    ✅   │    —    │
│ Artist live moderation             │    ✅   │    —    │
├────────────────────────────────────┼─────────┼─────────┤
│ AUTH & SECURITY                    │         │         │
├────────────────────────────────────┼─────────┼─────────┤
│ Firebase Auth (Email/Google/Apple) │    ✅   │    ✅   │
│ Session cookies (SSR)              │    ✅   │    —    │
│ Bearer token (API)                 │    ✅   │    ✅   │
│ Role-based access                  │    ✅   │    ✅   │
└────────────────────────────────────┴─────────┴─────────┘
```

---

## Data Flow Diagrams

### 1. Live Radio Playback Flow

```
┌─────────────┐     GET /radio/current      ┌─────────────┐
│   Client    │ ──────────────────────────► │   Backend   │
│ (Web/Mobile)│                             │  (NestJS)   │
└─────────────┘                             └──────┬──────┘
       │                                           │
       │                                           ▼
       │                                    ┌─────────────┐
       │                                    │    Redis    │
       │                                    │ (radio:now) │
       │                                    └──────┬──────┘
       │                                           │
       │         { song, artist, playId,           │
       │           streamUrl, trialByFireActive }  │
       │ ◄─────────────────────────────────────────┘
       │
       ▼
┌─────────────┐     Stream audio from        ┌─────────────┐
│   Player    │ ──────────────────────────► │  Supabase   │
│ (HLS/just_  │                             │   Storage   │
│   audio)    │ ◄────────────────────────── │             │
└─────────────┘        Audio data           └─────────────┘
       │
       │  POST /radio/heartbeat (every 30s)
       │  POST /radio/play (on track change)
       ▼
┌─────────────┐
│   Backend   │ ──► Update listener count in Redis
└─────────────┘ ──► Log play in Supabase
```

### 2. Artist Upload Flow

```
┌─────────────┐  POST /uploads/signed-url   ┌─────────────┐
│   Artist    │ ──────────────────────────► │   Backend   │
│ (Web/Mobile)│                             └──────┬──────┘
└─────────────┘                                    │
       │                                           ▼
       │         { signedUrl, path }        ┌─────────────┐
       │ ◄───────────────────────────────── │  Supabase   │
       │                                    │   Storage   │
       │                                    └─────────────┘
       │
       │  PUT (upload file to signedUrl)
       ▼
┌─────────────┐                             ┌─────────────┐
│  Supabase   │ ◄─────────────────────────  │   Artist    │
│   Storage   │      Audio + Artwork        │             │
└─────────────┘                             └─────────────┘
       │
       │  POST /songs (metadata + paths)
       ▼
┌─────────────┐                             ┌─────────────┐
│   Backend   │ ──────────────────────────► │  Supabase   │
│ (validate)  │      Insert song row        │  PostgreSQL │
│             │      status: 'pending'      │             │
└─────────────┘                             └─────────────┘
```

### 3. Payment Flow (Credits)

```
┌─────────────┐  POST /payments/create-     ┌─────────────┐
│   Artist    │  checkout-session           │   Backend   │
│    (Web)    │ ──────────────────────────► │             │
└─────────────┘                             └──────┬──────┘
       │                                           │
       │                                           ▼
       │                                    ┌─────────────┐
       │                                    │   Stripe    │
       │                                    │  Checkout   │
       │         { sessionUrl }             └──────┬──────┘
       │ ◄─────────────────────────────────────────┘
       │
       │  Redirect to Stripe Checkout
       ▼
┌─────────────┐                             ┌─────────────┐
│   Stripe    │ ──────────────────────────► │   Artist    │
│  Checkout   │      Payment completed      │             │
└─────────────┘                             └─────────────┘
       │
       │  Webhook: checkout.session.completed
       ▼
┌─────────────┐                             ┌─────────────┐
│   Backend   │ ──────────────────────────► │  Supabase   │
│  (webhook)  │      Credit user balance    │  PostgreSQL │
└─────────────┘                             └─────────────┘
```

### 4. Ripple / radio vote flow

```
┌─────────────┐  POST /leaderboard/songs/   ┌─────────────┐
│  Listener   │  :id/like { playId,         │   Backend   │
│ (Web/Mobile)│   reaction?: fire|shit }    │             │
└─────────────┘ ──────────────────────────► └──────┬──────┘
       │                                           │
       │                                           ▼
       │                                    ┌─────────────┐
       │                                    │  Supabase   │
       │                                    │ leaderboard_│
       │                                    │ likes + RPC │
       │                                    │ refresh_song│
       │                                    │ _temperature│
       │                                    └──────┬──────┘
       │                                           │
       │                          (optional)       ▼
       │                                    ┌─────────────┐
       │                                    │  likes      │
       │                                    │  INSERT if  │
       │                                    │  reaction   │
       │                                    │  is fire    │
       │                                    └──────┬──────┘
       │                                           │
       │                                           ▼
       │                                    ┌─────────────┐
       │                                    │  Supabase   │
       │                                    │  Realtime   │
       │ ◄───────────────────────────────── │ postgres_   │
       │         likes / leaderboard_likes  │ changes     │
       │                                    └─────────────┘
       │
       ▼
┌─────────────┐
│  Clients    │  GET /radio/current picks up temperature_percent;
│             │  Ripple / vote map UI updates
└─────────────┘
```

---

## Technology Stack Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
├─────────────────────────────┬───────────────────────────────────┤
│          WEB                │            MOBILE                 │
├─────────────────────────────┼───────────────────────────────────┤
│ Next.js 16 (App Router)     │ Flutter 3.38+                     │
│ React 19                    │ Dart                              │
│ TypeScript                  │ Provider (state)                  │
│ shadcn/ui                   │ just_audio + audio_service        │
│ Tailwind CSS                │ firebase_auth                     │
│ Hls.js (audio)              │ flutter_stripe                    │
│ Supabase Realtime           │ supabase_flutter                  │
│ PWA (manifest + SW)         │ geolocator                        │
└─────────────────────────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND                                  │
├─────────────────────────────────────────────────────────────────┤
│ NestJS 11 (Node.js 22+)                                         │
│ TypeScript                                                      │
│ REST API (/api/*)                                               │
│ Firebase Admin SDK                                              │
│ Supabase JS Client                                              │
│ ioredis                                                         │
│ Stripe SDK                                                      │
│ Winston (logging)                                               │
│ Sentry (errors)                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE                             │
├─────────────────────────────────────────────────────────────────┤
│ Redis          │ Radio state, listener counts, emoji cache     │
│ Supabase       │ PostgreSQL, Realtime, Storage                 │
│ Firebase       │ Auth, FCM push notifications                  │
│ Stripe         │ Payments, subscriptions, webhooks             │
│ Cloudflare     │ Stream (artist livestream)                    │
│ Docker         │ Local dev (redis, backend)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Roles & Access

```
┌─────────────────────────────────────────────────────────────────┐
│                         ROLES                                   │
├──────────────┬──────────────────────────────────────────────────┤
│   LISTENER   │ • Listen to radio                               │
│ (Prospector) │ • Vote/Ripple on tracks                         │
│              │ • Live chat                                      │
│              │ • Yield rewards (check-in, refinement, redeem)  │
│              │ • Refinery (rank, comment)                      │
│              │ • Discovery / Pro-Directory (browse)            │
├──────────────┼──────────────────────────────────────────────────┤
│    ARTIST    │ • All listener features                         │
│              │ • Upload songs                                   │
│              │ • Buy & allocate credits                        │
│              │ • Analytics (The Wake)                          │
│              │ • Go live (artist livestream)                   │
│              │ • Receive donations                             │
│              │ • Add songs to Refinery                         │
├──────────────┼──────────────────────────────────────────────────┤
│   SERVICE    │ • All listener features                         │
│   PROVIDER   │ • Pro-NETWORX profile                           │
│              │ • Listed in Pro-Directory                       │
│              │ • Receive messages (Creator Network)            │
│              │ • Job board access                              │
├──────────────┼──────────────────────────────────────────────────┤
│    ADMIN     │ • All features                                  │
│              │ • Song moderation (approve/reject)              │
│              │ • User management (ban, roles)                  │
│              │ • Radio queue control                           │
│              │ • Fallback playlist management                  │
│              │ • Free rotation toggle                          │
│              │ • Artist live moderation                        │
│              │ • Platform analytics                            │
└──────────────┴──────────────────────────────────────────────────┘
```

---

## Folder Structure

```
RadioApp/
├── backend/                 # NestJS API server
│   └── src/
│       ├── admin/           # Admin endpoints
│       ├── analytics/       # The Wake analytics
│       ├── artist-live/     # Livestream module
│       ├── auth/            # Firebase auth guard
│       ├── chat/            # Live chat
│       ├── credits/         # Credit system
│       ├── discovery/       # Pro-Directory
│       ├── leaderboard/     # Competition
│       ├── payments/        # Stripe integration
│       ├── prospector/      # Yield & Refinery
│       ├── push-notifications/
│       ├── radio/           # Core radio logic
│       ├── songs/           # Song management
│       ├── uploads/         # Signed URL uploads
│       └── users/           # User profiles
│
├── web/                     # Next.js web app
│   └── src/
│       ├── app/             # App Router pages
│       ├── components/      # UI components
│       └── lib/             # Utilities
│
├── mobile/                  # Flutter mobile app
│   └── lib/
│       ├── core/            # Auth, services, models
│       ├── features/        # Feature screens
│       └── widgets/         # Shared widgets
│
├── admin/                   # Admin dashboard (Next.js)
├── pro-web/                 # Pro-NETWORX portal (Next.js)
└── docs/                    # Documentation
```

---

*Generated: March 2026*
