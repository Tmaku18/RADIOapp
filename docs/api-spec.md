# API Specification

Base URL: `http://localhost:3000/api`

> **Product terminology**: In the UI and marketing, we use **Prospectors** (audience), **Ripples** (likes), **The Wake** (analytics), **The Yield** (Prospector rewards), **The Refinery** (Prospector portal for reviewing ores), and **Ore's** (songs). This spec uses technical names (e.g. `songs`, `likes`, `listener`). See [branding-terminology.md](branding-terminology.md).

All endpoints require Firebase ID token in Authorization header: `Authorization: Bearer <token>`

## Authentication

### Verify Token
- **GET** `/auth/verify`
- Returns user info from verified token

## Users

### Get Current User
- **GET** `/users/me`
- Returns current user profile

### Update User Profile
- **PUT** `/users/me`
- Body: `{ displayName?: string, avatarUrl?: string }`

### Get User by ID
- **GET** `/users/:id`
- Returns user profile

## Songs

### Upload Song
- **POST** `/songs/upload`
- Content-Type: `multipart/form-data`
- Fields: `audio` (file), `artwork` (file, optional), `title` (string), `artistName` (string)
- Returns: `{ id, title, artistName, audioUrl, artworkUrl }`

### Get Songs
- **GET** `/songs`
- Query params: `?artistId=uuid&status=approved&limit=20&offset=0`
- Returns: Array of songs

### Get Song by ID
- **GET** `/songs/:id`
- Returns: Song details

### Like Song
- **POST** `/songs/:id/like`
- Toggles like status

### Unlike Song
- **DELETE** `/songs/:id/like`

## Radio

Track selection (free vs paid mode, four-tier fallback, artist spacing) is documented in **`docs/radio-logic.md`**.

### Get Current Track
- **GET** `/radio/current`
- Returns: Current playing song with metadata.
- Notes:
  - Includes `artist_id` and may include `pinned_catalysts` (Catalyst deep-link credits) during airtime.

### Get Next Track
- **GET** `/radio/next`
- Returns: Next song in rotation (chosen by backend using tiers and artist spacing; see `docs/radio-logic.md`)

### Report Play
- **POST** `/radio/play`
- Body: `{ songId: uuid, skipped?: boolean }`
- Logs play event

### Heartbeat (verified listening)
- **POST** `/radio/heartbeat`
- Body: `{ songId: uuid, streamToken?: string, timestamp?: string }`
- Records a 30s listening heartbeat for Prospectors (technical role `listener`). Used for proof-of-listening and Yield accrual gating.

## Prospector (Yield program)

### Get Yield
- **GET** `/prospector/yield`
- Returns: `{ balanceCents, tier, oresRefinedCount }`

### Check-in
- **POST** `/prospector/check-in`
- Body: `{ sessionId?: uuid }`
- Records an anti-bot check-in (Ripple tap). Yield accrual is gated by check-ins every ~20 minutes.

### Submit Refinement
- **POST** `/prospector/refinement`
- Body: `{ songId: uuid, score: 1..10, playId?: uuid }`
- Idempotent per user + song; first submission increases ores refined count and credits Yield.

### Submit Survey
- **POST** `/prospector/survey`
- Body: `{ songId: uuid, responses: object, playId?: uuid }`
- Idempotent per user + song; first submission credits Yield.

### Redeem
- **POST** `/prospector/redeem`
- Body: `{ amountCents: 1000|2500, type: 'virtual_visa'|'merch'|'boost_credits' }`
- Creates a redemption request and deducts balance.

## The Refinery (Prospector portal)

The Refinery is a portal where artists submit uploaded songs for review. Only Prospectors (listeners who sign up) can access it: they hear songs unlimited times, answer survey questions, rank (1–10), and leave comments to earn Yield rewards. Regular listeners do not have access.

### List Refinery songs
- **GET** `/refinery/songs`
- Query params: `?limit=100&offset=0`
- Returns: `{ songs: Array<{ id, title, artist_name, artwork_url, audio_url, duration_seconds, created_at }>, limit, offset }`
- Roles: listener, artist, admin

### Add song to Refinery (artist)
- **POST** `/refinery/songs/:id/add`
- Artist adds their own song to The Refinery for Prospector review.
- Roles: artist, admin

### Remove song from Refinery (artist)
- **POST** `/refinery/songs/:id/remove`
- Artist removes their song from The Refinery.
- Roles: artist, admin

### Get comments for a refinery song
- **GET** `/refinery/songs/:id/comments`
- Query params: `?limit=50&offset=0`
- Returns: `{ comments: Array<{ id, body, created_at, users?: { display_name } }>, limit, offset }`

### Post comment (Prospector)
- **POST** `/refinery/songs/:id/comments`
- Body: `{ body: string }`
- Prospector leaves a comment on a refinery song. Rewards are credited via existing Yield (refinement + survey).

## Payments

### Create Payment Intent
- **POST** `/payments/create-intent`
- Body: `{ amount: number, credits: number }`
- Returns: `{ clientSecret: string }`

### Song Plays Pricing (per-song)
- **GET** `/payments/song-play-price?songId=uuid`
- Returns pricing options for buying plays for a specific song (used by Studio “Buy plays” and quick-buy UX).

### Create Payment Intent (buy song plays)
- **POST** `/payments/create-intent-song-plays`
- Body: `{ songId: uuid, plays: number }`
- Returns: `{ clientSecret: string }`

### Quick Buy (Add 5 Minutes)
- **POST** `/payments/quick-add-minutes`
- Body: `{ songId: uuid }`
- Returns: Stripe session payload (web) for a fixed quick-buy quantity (5 plays).

### Webhook (Stripe)
- **POST** `/payments/webhook`
- Handles Stripe webhook events

### Get Transactions
- **GET** `/payments/transactions`
- Returns: User's transaction history

## Credits

### Get Credit Balance
- **GET** `/credits/balance`
- Returns: `{ balance: number, totalPurchased: number, totalUsed: number }`

## Analytics (artist/admin)

### Artist Analytics Summary
- **GET** `/analytics/me?days=30`
- Returns: plays/likes/songs summary + top songs + daily plays (for artist dashboards).

### ROI
- **GET** `/analytics/me/roi?days=30`
- Returns: `{ days, newFollowers, creditsSpentInWindow, roi }`

### Listener Heatmap (proxy)
- **GET** `/analytics/me/plays-by-region?days=30`
- Returns: Array of `{ region, count }` (proxy using profile-click engagement grouped by region).

## Leaderboard

### Trial by Fire (upvotes per minute)
- **GET** `/leaderboard/upvotes-per-minute?windowMinutes=60&limit=50&offset=0`
- Returns: ranked songs with window metrics: `likesInWindow`, `playsInWindow`, `upvotesPerMinute`, `windowMinutes`.

## Discovery / Pro-Directory

### List People (service providers / artists)
- **GET** `/discovery/people`
- Query params (common): `role=service_provider`, `serviceType`, `search`, `minRateCents`, `maxRateCents`, `location`, `lat`, `lng`, `radiusKm`, `limit`, `offset`
- Returns: `{ items: DiscoveryProfile[], total: number }` (or array depending on client)

## Service Providers

### Get Provider Profile
- **GET** `/service-providers/:userId`
- Returns: provider profile + listings + portfolio.

## Venue Ads

### Get Current Venue Ad
- **GET** `/venue-ads/current?stationId=global`
- Returns: current venue partner slot for a station.

## Realtime Events (Supabase)

The platform emits realtime events through Supabase Realtime. Clients subscribe via `postgres_changes`:

- **Likes**: `public.likes` `INSERT` (used by Live Ripple and Global Vote Map visuals).
- **Rising Star**: `public.station_events` `INSERT` with filter `type=eq.rising_star` (used for “Butterfly Ripple” banner).

## Admin (Admin role required)

### Get All Songs
- **GET** `/admin/songs`
- Query params: `?status=pending&limit=50&offset=0`

### Approve/Reject Song
- **PATCH** `/admin/songs/:id`
- Body: `{ status: 'approved' | 'rejected' }`

### Get Analytics
- **GET** `/admin/analytics`
- Returns: Platform statistics

### Get Rotation Queue
- **GET** `/admin/radio/queue`
- Returns: Current rotation queue

### Override Next Track
- **POST** `/admin/radio/override`
- Body: `{ songId: uuid }`
