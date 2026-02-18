# API Specification

Base URL: `http://localhost:3000/api`

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
