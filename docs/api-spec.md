# API Specification

Route reference for the NestJS backend (`backend/src/**/*.controller.ts`). Every path below sits under the global prefix `/api`.

> **Product terminology**: In the UI and marketing, we use **Prospectors** (audience), **Ripples** (likes), **The Wake** (analytics), **The Yield** (Prospector rewards), **The Refinery** (Prospector portal for reviewing songs), and **Songs**. This spec uses technical names (e.g. `songs`, `likes`, `listener`). See [branding-terminology.md](branding-terminology.md).

## Base URLs

| Environment | Base |
|---|---|
| Local | `http://localhost:3000/api` |
| Production (web) | `https://www.networxradio.com/api` and `https://www.pro-networx.com/api` (Next.js rewrites to the backend) |
| Production (direct) | `https://backend-production-17cc.up.railway.app/api` (the mobile app tries this first) |

## Access model

Three global guards run on every route (`backend/src/auth/auth.module.ts`):

1. **FirebaseAuthGuard** — requires `Authorization: Bearer <Firebase ID token>`. Routes marked `@Public()` accept requests without a token; when a token is sent it is still verified so signed-in viewers get personalized results. Banned accounts and accounts past their 48-hour deletion window are rejected.
2. **RolesGuard** — enforces `@Roles(...)`. Roles come from `users.role` plus the `users.user_roles` maker-role array. Hierarchy: `admin` satisfies everything; `artist` is satisfied by `artist`, `service_provider`, `dj`, `musician`, or `admin`; `listener` is satisfied by any profile.
3. **PhoneMfaGuard** — each Firebase sign-in must confirm a text-message code (`/auth/phone/*`) before other authenticated routes work. The error body carries `details.code = "PHONE_MFA_REQUIRED"`. Routes marked `@SkipPhoneMfa()` (the Auth controller and profile bootstrap routes) are exempt.

Legend for the **Access** column:

- **Public** — no token required.
- **Auth** — valid Firebase token; **Auth (artist)** etc. adds a role requirement; **any profile** means any role with a profile row.
- **no MFA** — the phone-code check is skipped.
- **multipart** — `multipart/form-data` upload. **throttled** — per-route rate limit (30 requests/min on `/radio/next` and `/radio/presence`).

A global throttler (120 requests/min per client) also applies to all routes.

## Health and app

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/` | Auth |  |
| GET | `/health` | Public | Liveness probe |
| GET | `/app/version` | Public | `platform`; Latest and minimum app version for update prompts |
| GET | `/flags` | Public | Client feature flags (crossfade, degraded playback, …) |
| PUT | `/flags` | Auth (admin) |  |

## Auth

The whole controller skips the phone-code check so sign-in can finish.

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/auth/verify` | Auth · no MFA | Returns the verified Firebase identity |
| POST | `/auth/phone/send` | Auth · no MFA | Texts a sign-in code to the account's mobile number |
| POST | `/auth/phone/verify` | Auth · no MFA | Confirms the code for this Firebase sign-in |
| POST | `/auth/cross-domain-token` | Public | One-time token to move a session between networxradio.com and pro-networx.com |
| POST | `/auth/cross-domain-exchange` | Public | Trades that token for a Firebase custom token |

## Users

| Method | Path | Access | Query / notes |
|---|---|---|---|
| POST | `/users` | Auth · no MFA | Create the profile after first sign-in (display name, role, maker roles) |
| GET | `/users/me` | Auth · no MFA |  |
| DELETE | `/users/me` | Auth · no MFA | Schedules deletion; signing in again within 48 hours restores the account |
| POST | `/users/me/apple-authorization` | Auth · no MFA |  |
| GET | `/users/me/check-admin` | Auth · no MFA |  |
| GET | `/users/username-available` | Auth | `u` |
| GET | `/users/by-username/:username` | Public |  |
| PUT | `/users/me` | Auth | Profile fields, maker roles (`userRoles`), notification prefs |
| GET | `/users/me/favorites` | Auth | `limit`, `offset` |
| GET | `/users/me/artist-like-notifications` | Auth |  |
| PUT | `/users/me/artist-like-notifications` | Auth |  |
| GET | `/users/me/blocks` | Auth |  |
| POST | `/users/me/avatar` | Auth · multipart |  |
| POST | `/users/upgrade-to-artist` | Auth |  |
| POST | `/users/upgrade-to-catalyst` | Auth | Grants the `service_provider` role |
| GET | `/users/:id/artist-profile` | Public | Public artist page payload (catalog, follow counts) |
| GET | `/users/:id` | Auth |  |
| POST | `/users/:id/follow` | Auth |  |
| DELETE | `/users/:id/follow` | Auth |  |
| GET | `/users/:id/follow` | Auth |  |
| POST | `/users/:id/favorite` | Auth |  |
| DELETE | `/users/:id/favorite` | Auth |  |
| GET | `/users/:id/favorite` | Auth |  |
| GET | `/users/:id/block-status` | Auth |  |
| POST | `/users/:id/report` | Auth |  |
| POST | `/users/:id/block` | Auth |  |
| DELETE | `/users/:id/block` | Auth |  |
| GET | `/users/:id/follow-counts` | Public |  |
| GET | `/users/:id/followers` | Public | `limit`, `offset` |
| GET | `/users/:id/friends` | Public | `limit`, `offset` |
| GET | `/users/:id/following` | Public | `limit`, `offset` |

## Radio

Rotation, station ids, and temperature are described in [radio-logic.md](radio-logic.md). Every `radio` query param is normalized: blank, `global`, `default`, or an unknown id resolves to `us-ready-now-rap`.

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/radio/current` | Public | `radio`; Now playing for one station with timing and score fields (see below); served from a cached snapshot when fresh |
| GET | `/radio/next` | Public · throttled | `radio`, `force`, `after`; `force=1` asks to advance; `after=<songId>` names the song the caller just finished so stale or early requests are ignored |
| POST | `/radio/play` | Auth | Body `{ songId, skipped? }` |
| POST | `/radio/heartbeat` | Auth | Body `{ songId, streamToken?, timestamp? }`. Signed-in proof of listening; feeds Yield and live listener counts |
| POST | `/radio/presence` | Public · throttled | Same body as heartbeat. Guests send this so they count as listeners |
| GET | `/radio/peek` | Public | `radio`; Next song without consuming the queue |
| GET | `/radio/queue` | Public | `limit`, `radio`; Upcoming songs from the station's rotation stack |
| DELETE | `/radio/queue` | Auth (admin) | `radio`; Clears queue state for one station |

## Prospector and Yield

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/prospector/yield` | Auth | `{ balanceCents, tier, songsRefinedCount }` |
| POST | `/prospector/check-in` | Auth | Anti-bot check-in that gates Yield accrual |
| POST | `/prospector/refinement` | Auth | Body `{ songId, score: 1..10, playId? }`; first submission per song credits Yield |
| POST | `/prospector/survey` | Auth | Body `{ songId, responses, playId? }` |
| POST | `/prospector/redeem` | Auth |  |
| POST | `/yield/redeem` | Auth |  |

## Leaderboard, competition, spotlight

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/leaderboard/songs` | Auth | `by`, `limit`, `offset`; `by` = `likes` (default) · `listens` · `positive_votes` · `ratio` · `saves`; `limit` ≤ 100 |
| GET | `/leaderboard/upvotes-per-minute` | Auth | `windowMinutes`, `limit`, `offset`; Trial by Fire; `windowMinutes` 1–1440 (default 60) |
| POST | `/leaderboard/songs/:id/like` | Auth | Radio vote. Body `{ playId?, reaction? }` where `reaction` is `fire` (default) or `shit`. Same reaction again removes the vote; a different one switches it. Fire also saves the song to Liked |
| GET | `/competition/current-week` | Auth |  |
| POST | `/competition/vote` | Auth |  |
| GET | `/competition/weekly-results` | Auth | `period` |
| GET | `/competition/monthly-winners` | Auth | `year`, `month` |
| GET | `/competition/yearly-winners` | Auth | `year` |
| GET | `/spotlight/today` | Auth |  |
| GET | `/spotlight/week` | Auth | `start` |
| GET | `/spotlight/can-listen-unlimited` | Auth | `artistId`, `songId` |
| POST | `/spotlight/listen` | Auth |  |

## Chat (station Live Chat and song Comments)

| Method | Path | Access | Query / notes |
|---|---|---|---|
| POST | `/chat/send` | Auth | Body includes `radioId`, `songId`, and `kind` (`live` or `comment`) |
| DELETE | `/chat/messages/:id` | Auth |  |
| GET | `/chat/history` | Public | `limit`, `radioId`; Station Live Chat for `radioId` |
| GET | `/chat/comments` | Public | `songId`, `limit`; Per-song Comments thread |
| GET | `/chat/status` | Public | Chat enabled flag |
| POST | `/chat/emoji` | Auth |  |

## Songs

| Method | Path | Access | Query / notes |
|---|---|---|---|
| POST | `/songs/upload` | Auth · multipart | Fields `files` (audio + optional artwork, 100 MB each), title, artist name, origin city/state, `stationId`/`stationIds`, explicit flag, lyrics |
| POST | `/songs/upload-url` | Auth (artist) | Signed storage URL for direct upload |
| POST | `/songs` | Auth (artist) | Create a song from uploaded storage paths; new songs start `pending` |
| GET | `/songs/station-counts` | Public | Approved song count per station |
| GET | `/songs/public/trending` | Public | `limit` |
| GET | `/songs` | Public | `artistId`, `status`, `limit`, `offset` |
| GET | `/songs/discover/feed` | Public | `limit`, `cursor`, `seed`, `stationId`; Discover swipe deck; guests allowed |
| POST | `/songs/discover/swipe` | Auth (any profile) |  |
| GET | `/songs/artists/search` | Public | `q`, `limit`; Artist search for Discover and Search |
| GET | `/songs/discover/list` | Auth (any profile) | `limit`, `offset` |
| GET | `/songs/discover/liked-artists` | Auth (any profile) | `limit`, `offset` |
| GET | `/songs/discover/history` | Auth (any profile) | `direction`, `limit`, `offset` |
| DELETE | `/songs/discover/list/:songId` | Auth (any profile) |  |
| DELETE | `/songs/discover/list` | Auth (any profile) |  |
| DELETE | `/songs/discover/swipes/:songId` | Auth (any profile) |  |
| DELETE | `/songs/discover/swipes` | Auth (any profile) |  |
| POST | `/songs/:id/discover/publish` | Auth (any profile) |  |
| GET | `/songs/mine` | Auth (any profile) |  |
| GET | `/songs/library` | Auth (any profile) | Liked songs (`likes`) |
| GET | `/songs/saved-status` | Auth | `ids` |
| GET | `/songs/favorites` | Auth (any profile) | Starred songs (`song_favorites`), separate from likes |
| GET | `/songs/beats/marketplace` | Public | `q`, `artistId`, `limit`, `offset`; Beats for sale |
| POST | `/songs/admin/backfill-lyrics` | Auth (admin) |  |
| POST | `/songs/admin/backfill-samples` | Auth (admin) |  |
| POST | `/songs/admin/backfill-copyright` | Auth (admin) |  |
| GET | `/songs/purchases` | Auth (any profile) |  |
| GET | `/songs/:id/access` | Auth (any profile) | Whether the caller can stream the full song (purchase, owner, or Pro-Radio) |
| GET | `/songs/:id/stream` | Auth (any profile) | Full-song URL for buyers, owners, and Pro-Radio subscribers on opted-in songs |
| GET | `/songs/:id/download` | Auth (any profile) |  |
| POST | `/songs/:id/sample` | Auth (any profile) |  |
| GET | `/songs/:id/lyrics` | Public | Timed lyrics when available |
| PATCH | `/songs/:id/lyrics` | Auth (artist) |  |
| GET | `/songs/:id` | Auth |  |
| PATCH | `/songs/:id` | Auth (artist) |  |
| DELETE | `/songs/:id` | Auth (artist) |  |
| POST | `/songs/:id/backfill-duration` | Auth (artist) |  |
| GET | `/songs/:id/like` | Auth |  |
| GET | `/songs/:id/likes` | Public | `limit`, `offset` |
| POST | `/songs/:id/like` | Auth | Toggles a profile like (`likes`) |
| DELETE | `/songs/:id/like` | Auth |  |
| GET | `/songs/:id/favorite` | Auth |  |
| POST | `/songs/:id/favorite` | Auth |  |
| DELETE | `/songs/:id/favorite` | Auth |  |
| GET | `/songs/:id/rating` | Auth |  |
| POST | `/songs/:id/rating` | Auth | Body `{ rating: 1..10 }`; stored apart from fire/poop votes |
| POST | `/songs/:id/profile-listen` | Public | Counts a listen from an artist profile |

## Albums, playlists, song stories

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/albums/mine` | Auth (artist) |  |
| POST | `/albums` | Auth (artist) |  |
| PATCH | `/albums/:id` | Auth (artist) |  |
| DELETE | `/albums/:id` | Auth (artist) |  |
| PUT | `/albums/:id/tracks` | Auth (artist) |  |
| POST | `/albums/:id/tracks` | Auth (artist) |  |
| DELETE | `/albums/:id/tracks/:songId` | Auth (artist) |  |
| GET | `/playlists/mine` | Auth |  |
| GET | `/playlists/catalog` | Auth | `q`; Songs that can be added to Pro-Radio playlists |
| POST | `/playlists` | Auth |  |
| PATCH | `/playlists/:id` | Auth |  |
| DELETE | `/playlists/:id` | Auth |  |
| GET | `/playlists/:id/tracks` | Auth |  |
| POST | `/playlists/:id/tracks` | Auth |  |
| DELETE | `/playlists/:id/tracks/:songId` | Auth |  |
| POST | `/playlists/:id/reorder` | Auth |  |
| GET | `/song-stories` | Auth | `songId`; Live stories (24 h) attached to a song |
| POST | `/song-stories` | Auth | Post a clip as a story; visibility `public`, `private`, or `hidden` |
| PATCH | `/song-stories/:id` | Auth |  |
| DELETE | `/song-stories/:id` | Auth |  |

## Discovery (people, feed, map)

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/discovery/people/directory` | Public | `lat`, `lng`, `radiusKm`, `limit`, `include`, `role` |
| GET | `/discovery/people` | Public | `serviceType`, `location`, `search`, `role`, `limit`, `offset`, `minRateCents`, `maxRateCents`, `lat`, `lng`, `radiusKm`, `mode`, `sort`, `genre`, `seed`; Directory search. `role`, `serviceType`, rate range, geo (`lat`,`lng`,`radiusKm`), `sort` = `popularity` · `songs` · `recent`, `mode` = `default` · `random` |
| GET | `/discovery/feed` | Public | `limit`, `cursor`, `scope`; `scope` = `all` or `following` |
| POST | `/discovery/feed/posts/:id/like` | Auth |  |
| DELETE | `/discovery/feed/posts/:id/like` | Auth |  |
| DELETE | `/discovery/feed/posts/:id` | Auth |  |
| POST | `/discovery/feed/posts/:id/bookmark` | Auth |  |
| DELETE | `/discovery/feed/posts/:id/bookmark` | Auth |  |
| POST | `/discovery/feed/posts/:id/report` | Auth |  |
| GET | `/discovery/feed/bookmarks` | Auth | `limit`, `cursor` |
| GET | `/discovery/feed/liked` | Auth | `limit`, `cursor` |
| GET | `/discovery/feed/posts/:id/comments` | Public | `limit`, `before` |
| POST | `/discovery/feed/posts/:id/comments` | Auth |  |
| DELETE | `/discovery/feed/comments/:id` | Auth |  |
| GET | `/discovery/feed/search` | Public | `q` |
| GET | `/discovery/feed/explore` | Public | `limit`, `seed` |
| GET | `/discovery/feed/users/:userId/posts` | Public | `limit`, `cursor` |
| GET | `/discovery/feed/explore-stream` | Public | `cursor`, `anchorPostId`, `limit` |
| GET | `/discovery/map/heat` | Auth | `station`, `role`, `zoom`, `minLat`, `maxLat`, `minLng`, `maxLng`; Map tiles use approximate locations, never exact addresses |
| GET | `/discovery/map/clusters` | Auth | `station`, `role`, `zoom`, `minLat`, `maxLat`, `minLng`, `maxLng` |
| GET | `/discovery/map/artists` | Auth | `station`, `role`, `minLat`, `maxLat`, `minLng`, `maxLng`, `clusterLat`, `clusterLng`, `clusterRadiusKm`, `limit`, `offset` |
| POST | `/discovery/feed` | Auth (any profile) · multipart |  |
| POST | `/discovery/feed/upload-url` | Auth (any profile) | Signed URL so feed video/audio uploads go straight to storage |
| POST | `/discovery/feed/from-upload` | Auth (any profile) · multipart | Publish a post from an uploaded object; media length is re-checked server-side |

## Browse and feed

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/browse/feed` | Auth | `limit`, `cursor`, `seed` |
| POST | `/browse/feed/:contentId/like` | Auth |  |
| POST | `/browse/feed/:contentId/bookmark` | Auth |  |
| DELETE | `/browse/feed/:contentId/bookmark` | Auth |  |
| POST | `/browse/feed/:contentId/report` | Auth |  |
| GET | `/browse/leaderboard` | Auth | `limitPerCategory` |
| GET | `/browse/bookmarks` | Auth | `limit` |
| GET | `/feed/news-promotions` | Auth | `limit` |
| GET | `/suggestions/local-artists` | Auth | `limit` |
| GET | `/suggestions/genre-artists` | Auth | `genres`, `limit`, `seed` |
| GET | `/venue-ads/current` | Auth | `stationId` |

## Analytics (The Wake)

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/analytics/me` | Auth (artist) | `days`, `songId` |
| GET | `/analytics/me/roi` | Auth (artist) | `days` |
| GET | `/analytics/me/plays-by-region` | Auth (artist) | `days` |
| GET | `/analytics/me/discover-swipes` | Auth (artist) | `days` |
| GET | `/analytics/songs/:id` | Auth (artist) | `days` |
| GET | `/analytics/plays/:playId` | Auth (artist) |  |
| POST | `/analytics/profile-click` | Auth (any profile) · throttled |  |
| GET | `/analytics/platform` | Public | Public platform totals |
| GET | `/analytics/platform/live` | Public | Live listener totals |

## Credits and placements

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/credits/balance` | Auth | Placement balance and welcome placements |
| GET | `/credits/transactions` | Auth | `limit`, `offset` |
| GET | `/credits/allocations` | Auth (artist) | `limit` |
| POST | `/credits/songs/:songId/allocate` | Auth (artist) | Retired; returns 400 (placements are bought per song) |
| POST | `/credits/songs/:songId/withdraw` | Auth (artist) | Retired; returns 400 |
| POST | `/credits/songs/:songId/apply-welcome-placements` | Auth (artist) | Spend signup welcome placements on an approved song; blocked while `BETA_ALL_FREE` is on |

## Payments

Web pays through Stripe Checkout. iOS and Android digital goods go through Apple In-App Purchase and Google Play Billing; the app sends the store receipt to the `complete` endpoints. Store server notifications and the Stripe webhook are public and verified by signature.

| Method | Path | Access | Query / notes |
|---|---|---|---|
| POST | `/payments/create-intent` | Auth | Legacy Stripe PaymentIntent |
| POST | `/payments/google-play/complete` | Auth (any profile) | Body `{ productId, purchaseToken, songId? }` |
| POST | `/payments/app-store/complete` | Auth (any profile) | Body `{ productId, signedTransaction?, transactionId?, songId? }` (send one of the two transaction fields) |
| POST | `/payments/app-store/complete-subscription` | Auth (any profile) |  |
| POST | `/payments/google-play/complete-subscription` | Auth (any profile) |  |
| POST | `/payments/app-store/notifications` | Public | App Store Server Notifications v2 (refunds, renewals) |
| POST | `/payments/google-play/rtdn` | Public | Google Play real-time developer notifications |
| GET | `/payments/song-play-price` | Auth (artist) | `songId`; Placement pricing for one song |
| POST | `/payments/checkout-session-song-plays` | Auth (artist) | Stripe Checkout for placements on one song |
| POST | `/payments/quick-add-minutes` | Auth (artist) |  |
| POST | `/payments/create-intent-song-plays` | Auth (artist) |  |
| POST | `/payments/create-checkout-session` | Auth (artist) |  |
| POST | `/payments/create-creator-network-checkout-session` | Auth |  |
| POST | `/payments/create-pro-networx-checkout-session` | Auth |  |
| POST | `/payments/create-pro-networx-payment-sheet` | Auth |  |
| POST | `/payments/create-pro-radio-checkout-session` | Auth |  |
| POST | `/payments/create-pro-radio-payment-sheet` | Auth |  |
| POST | `/payments/create-pro-bundle-checkout-session` | Auth |  |
| POST | `/payments/create-pro-bundle-payment-sheet` | Auth |  |
| POST | `/payments/connect/onboard` | Auth (any profile) | Stripe Connect onboarding for artist payouts |
| GET | `/payments/connect/status` | Auth (any profile) |  |
| POST | `/payments/connect/login-link` | Auth (any profile) |  |
| POST | `/payments/songs/:songId/checkout` | Auth (any profile) | Stripe Checkout to buy a song or beat |
| POST | `/payments/webhook` | Public | Stripe webhook (raw body, signature verified) |
| GET | `/payments/transactions` | Auth |  |

## Subscription access

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/pro-network-subscription/access` | Auth | Pro-Networx messaging access (paywall payload when locked) |
| GET | `/pro-radio-subscription/access` | Auth | Pro-Radio on-demand access |
| GET | `/creator-network/access` | Auth |  |

## The Refinery

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/refinery/standard-questions` | Auth |  |
| POST | `/refinery/reviewer/signup` | Auth |  |
| GET | `/refinery/reviewer/status` | Auth |  |
| POST | `/refinery/songs/:id/submit` | Auth (artist) |  |
| POST | `/refinery/songs/:id/add` | Auth (artist) |  |
| POST | `/refinery/songs/:id/remove` | Auth (artist) |  |
| GET | `/refinery/songs` | Auth | `limit`, `offset`; Review queue |
| GET | `/refinery/songs/:id/review-form` | Auth |  |
| POST | `/refinery/songs/:id/review` | Auth | Reviewer answers, 1–10 rank, comment |
| GET | `/refinery/songs/:id/analytics` | Auth (artist) | `limit`, `offset` |
| POST | `/refinery/songs/:id/reviews/:reviewId/favorite` | Auth (artist) |  |
| POST | `/refinery/songs/:id/reviews/:reviewId/quality` | Auth (artist) |  |
| GET | `/refinery/songs/:id/comments` | Auth | `limit`, `offset` |
| POST | `/refinery/songs/:id/comments` | Auth |  |

## Artist livestream

| Method | Path | Access | Query / notes |
|---|---|---|---|
| POST | `/artist-live/start` | Auth |  |
| POST | `/artist-live/stop` | Auth |  |
| POST | `/artist-live/publishing` | Auth |  |
| GET | `/artist-live/sessions` | Public |  |
| GET | `/artist-live/streamer-status` | Auth |  |
| POST | `/artist-live/apply` | Auth |  |
| GET | `/artist-live/:artistId/status` | Public |  |
| GET | `/artist-live/:artistId/watch` | Public | Playback info (WHEP) for a live session |
| POST | `/artist-live/:sessionId/join` | Public |  |
| POST | `/artist-live/:sessionId/heartbeat` | Public |  |
| POST | `/artist-live/:sessionId/leave` | Public |  |
| POST | `/artist-live/webhook` | Public | Cloudflare Stream webhook |
| POST | `/artist-live/:sessionId/donations/intent` | Auth |  |
| POST | `/artist-live/:sessionId/donations/checkout` | Auth |  |
| POST | `/artist-live/:sessionId/report` | Auth |  |
| GET | `/artist-live/:sessionId/chat` | Public | `after`, `limit` |
| POST | `/artist-live/:sessionId/chat` | Auth |  |
| POST | `/artist-live/:sessionId/chat/:messageId/delete` | Auth |  |
| POST | `/artist-live/admin/sessions/:sessionId/force-stop` | Auth (admin) |  |
| POST | `/artist-live/admin/artists/:artistId/ban` | Auth (admin) |  |
| POST | `/artist-live/:sessionId/ads/impression` | Public |  |

## Live services and artist follows

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/live-services/artist/:artistId` | Auth |  |
| GET | `/live-services/upcoming` | Auth | `limit` |
| GET | `/live-services` | Auth (artist) |  |
| POST | `/live-services` | Auth (artist) |  |
| POST | `/live-services/support` | Auth (artist) |  |
| GET | `/live-services/:id` | Auth |  |
| PATCH | `/live-services/:id` | Auth (artist) |  |
| DELETE | `/live-services/:id` | Auth (artist) |  |
| POST | `/artists/:artistId/follow` | Auth |  |
| DELETE | `/artists/:artistId/follow` | Auth |  |
| GET | `/artists/:artistId/follow` | Auth |  |

## Pro-Networx

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/pro-networx/me/profile` | Auth |  |
| PUT | `/pro-networx/me/profile` | Auth |  |
| GET | `/pro-networx/directory` | Auth | `ListProDirectoryDto` |
| GET | `/pro-networx/profiles/:userId` | Auth |  |
| GET | `/pro-networx/public/directory` | Public | `ListProDirectoryDto`; Signed-out directory |
| GET | `/pro-networx/public/marketing-stats` | Public |  |
| GET | `/pro-networx/public/profiles/:userId` | Public | Signed-out view of a Pro profile |
| GET | `/pro-networx/services` | Auth | `serviceType`, `search`, `minPriceCents`, `maxPriceCents`, `limit`, `offset` |
| GET | `/pro-networx/services/:id` | Auth |  |
| GET | `/pro-networx/users/:userId/services` | Auth |  |
| GET | `/pro-networx/me/services` | Auth (artist) |  |
| POST | `/pro-networx/me/services` | Auth (artist) |  |
| PATCH | `/pro-networx/me/services/:id` | Auth (artist) |  |
| DELETE | `/pro-networx/me/services/:id` | Auth (artist) |  |
| GET | `/pro-networx/me/resume` | Auth (artist) |  |
| POST | `/pro-networx/me/resume` | Auth (artist) · multipart |  |
| DELETE | `/pro-networx/me/resume` | Auth (artist) |  |
| GET | `/service-providers/:userId` | Auth |  |
| GET | `/service-providers/me/profile` | Auth (service_provider) |  |
| PUT | `/service-providers/me/profile` | Auth (service_provider) |  |
| POST | `/service-providers/me/cover` | Auth (artist) · multipart |  |
| DELETE | `/service-providers/me/cover` | Auth (artist) |  |
| POST | `/service-providers/me/listings` | Auth (service_provider) |  |
| PATCH | `/service-providers/me/listings/:listingId` | Auth (service_provider) |  |
| DELETE | `/service-providers/me/listings/:listingId` | Auth (service_provider) |  |
| POST | `/service-providers/me/portfolio` | Auth (service_provider) |  |
| DELETE | `/service-providers/me/portfolio/:portfolioItemId` | Auth (service_provider) |  |
| POST | `/service-providers/portfolio/upload-url` | Auth (service_provider) |  |
| GET | `/studios` | Auth | `search`, `city`, `lat`, `lng`, `radiusKm`, `limit`; Studio listings with rate cards; `city` or geo filters |
| GET | `/studios/me` | Auth (artist) |  |
| GET | `/studios/people-search` | Auth (artist) | `q` |
| POST | `/studios/photos` | Auth (artist) · multipart | Upload a studio photo |
| GET | `/studios/:id` | Auth |  |
| POST | `/studios` | Auth (artist) |  |
| PATCH | `/studios/:id` | Auth (artist) |  |
| DELETE | `/studios/:id` | Auth (artist) |  |
| GET | `/job-board/requests` | Auth (any profile) | `serviceType`, `status`, `mine`, `limit`, `offset` |
| POST | `/job-board/requests` | Auth (any profile) |  |
| GET | `/job-board/requests/:requestId` | Auth (any profile) |  |
| DELETE | `/job-board/requests/:requestId` | Auth (any profile) |  |
| POST | `/job-board/requests/:requestId/applications` | Auth (any profile) |  |
| GET | `/job-board/requests/:requestId/applications` | Auth (any profile) |  |

## Direct messages

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/messages/conversations` | Auth | `search`; Inbox and message requests |
| GET | `/messages/conversations/:otherUserId` | Auth | `limit`, `before` |
| POST | `/messages/conversations/:otherUserId` | Auth |  |
| PATCH | `/messages/messages/:messageId` | Auth |  |
| POST | `/messages/messages/:messageId/unsend` | Auth |  |
| POST | `/messages/messages/:messageId/reactions` | Auth |  |
| DELETE | `/messages/messages/:messageId/reactions` | Auth | `emoji` |
| POST | `/messages/conversations/:otherUserId/accept` | Auth | Accept a message request |
| POST | `/messages/conversations/:otherUserId/read` | Auth |  |
| GET | `/messages/unread-summary` | Auth |  |
| POST | `/messages/conversations/:otherUserId/typing` | Auth |  |
| POST | `/messages/upload-url` | Auth | Signed URL for DM media |

## Notifications and push

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/notifications` | Auth | `limit` |
| GET | `/notifications/unread-count` | Auth |  |
| PATCH | `/notifications/:id/read` | Auth |  |
| POST | `/notifications/mark-all-read` | Auth |  |
| DELETE | `/notifications` | Auth |  |
| DELETE | `/notifications/:id` | Auth |  |
| POST | `/push-notifications/register-device` | Auth | Body `{ fcmToken, deviceType }` |
| POST | `/push-notifications/unregister-device` | Auth |  |
| GET | `/push-notifications/devices` | Auth |  |
| POST | `/push-notifications/test` | Auth |  |

## Growth, fans, moderation

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/growth/search` | Auth | `q`; Catalog search (`search_catalog` RPC) |
| GET | `/growth/referrals/me` | Auth |  |
| POST | `/growth/referrals/claim` | Auth | Claim a referral code |
| GET | `/growth/notifications` | Auth |  |
| PATCH | `/growth/notifications` | Auth |  |
| GET | `/growth/history` | Auth |  |
| POST | `/growth/history` | Auth |  |
| GET | `/growth/favorites` | Auth |  |
| GET | `/fans/me` | Auth |  |
| DELETE | `/fans/me/:fanId` | Auth |  |
| POST | `/fans/:artistId` | Auth · throttled | Join an artist's email list |
| POST | `/moderation/reports` | Auth | Body `{ targetType, targetId, reason }` |

## DJ Booth (admin)

Booth actions broadcast `dj_booth_event` messages on the station's realtime channel (see radio-logic.md).

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/admin/dj-booth/soundboard/clips` | Auth (admin) |  |
| POST | `/admin/dj-booth/soundboard/upload-url` | Auth (admin) |  |
| POST | `/admin/dj-booth/soundboard/clips` | Auth (admin) |  |
| DELETE | `/admin/dj-booth/soundboard/clips/:clipId` | Auth (admin) |  |
| GET | `/admin/dj-booth/:stationId` | Auth (admin) |  |
| GET | `/admin/dj-booth/:stationId/queue` | Auth (admin) | `limit` |
| PATCH | `/admin/dj-booth/:stationId/queue` | Auth (admin) |  |
| POST | `/admin/dj-booth/:stationId/queue` | Auth (admin) |  |
| DELETE | `/admin/dj-booth/:stationId/queue` | Auth (admin) | `position`, `stackId`, `songId` |
| POST | `/admin/dj-booth/:stationId/queue/skip` | Auth (admin) |  |
| POST | `/admin/dj-booth/:stationId/transport/pause` | Auth (admin) |  |
| POST | `/admin/dj-booth/:stationId/transport/play` | Auth (admin) |  |
| POST | `/admin/dj-booth/:stationId/transport/back` | Auth (admin) |  |
| POST | `/admin/dj-booth/:stationId/mic/session` | Auth (admin) |  |
| DELETE | `/admin/dj-booth/:stationId/mic/session` | Auth (admin) |  |
| POST | `/admin/dj-booth/:stationId/mic/on` | Auth (admin) |  |
| POST | `/admin/dj-booth/:stationId/mic/off` | Auth (admin) |  |
| PATCH | `/admin/dj-booth/:stationId/mic/duck-volume` | Auth (admin) |  |
| POST | `/admin/dj-booth/:stationId/soundboard/:clipId/play` | Auth (admin) |  |

## Admin

Every route here requires the `admin` role.

| Method | Path | Access | Query / notes |
|---|---|---|---|
| GET | `/admin/songs` | Auth (admin) | `status`, `search`, `sortBy`, `sortOrder`, `limit`, `offset`, `copyrightStatus`; `copyrightStatus` filters ACRCloud results |
| POST | `/admin/songs/:id/demonetize` | Auth (admin) | Copyright-flagged songs only; turns off sales |
| PATCH | `/admin/songs/:id` | Auth (admin) | Body `{ status, reason? }`; approval makes the song public, adds it to free rotation, and queues it next on its stations |
| PATCH | `/admin/songs/:id/metadata` | Auth (admin) |  |
| POST | `/admin/songs/:id/trim` | Auth (admin) |  |
| DELETE | `/admin/songs/:id` | Auth (admin) |  |
| GET | `/admin/swipe` | Auth (admin) | `search`, `limit`, `offset` |
| DELETE | `/admin/swipe/:songId/clip` | Auth (admin) |  |
| GET | `/admin/analytics` | Auth (admin) |  |
| GET | `/admin/payouts/pending` | Auth (admin) |  |
| POST | `/admin/payouts/:artistId/settle` | Auth (admin) |  |
| GET | `/admin/activity-flags` | Auth (admin) | Accounts flagged for vote or comment floods |
| GET | `/admin/users` | Auth (admin) | `role`, `search`, `sortBy`, `sortOrder`, `limit`, `offset` |
| GET | `/admin/users/:id` | Auth (admin) |  |
| GET | `/admin/streamer-applications` | Auth (admin) |  |
| PATCH | `/admin/streamer-applications/:userId` | Auth (admin) |  |
| PATCH | `/admin/users/:id/role` | Auth (admin) |  |
| GET | `/admin/radios` | Auth (admin) | `state` |
| GET | `/admin/radios/:id/queue-debug` | Auth (admin) | `limit` |
| GET | `/admin/radios/:id/queue` | Auth (admin) | `limit`; Station queue (`:id` is a station id) |
| POST | `/admin/radios/:id/queue` | Auth (admin) |  |
| PATCH | `/admin/radios/:id/queue` | Auth (admin) | Replace / reorder the queue |
| POST | `/admin/radios/:id/queue/skip` | Auth (admin) |  |
| DELETE | `/admin/radios/:id/queue` | Auth (admin) | `position`, `stackId`, `songId`, `source` |
| GET | `/admin/fallback-songs/grouped` | Auth (admin) |  |
| PATCH | `/admin/fallback-songs/:id/radios` | Auth (admin) |  |
| PATCH | `/admin/fallback-songs/:id/group` | Auth (admin) |  |
| DELETE | `/admin/fallback-songs/:id/group` | Auth (admin) |  |
| GET | `/admin/fallback-songs` | Auth (admin) | `radio` |
| POST | `/admin/fallback-songs` | Auth (admin) |  |
| POST | `/admin/fallback-songs/from-upload` | Auth (admin) |  |
| POST | `/admin/fallback-songs/from-song/:songId` | Auth (admin) | `radio` |
| PATCH | `/admin/fallback-songs/:id` | Auth (admin) |  |
| DELETE | `/admin/fallback-songs/:id` | Auth (admin) | `radio` |
| POST | `/admin/users/:id/hard-ban` | Auth (admin) |  |
| POST | `/admin/users/:id/shadow-ban` | Auth (admin) |  |
| POST | `/admin/users/:id/restore` | Auth (admin) |  |
| DELETE | `/admin/users/:id` | Auth (admin) |  |
| POST | `/admin/users/:id/lifetime-ban` | Auth (admin) |  |
| GET | `/admin/free-rotation/search/songs` | Auth (admin) | `q` |
| GET | `/admin/free-rotation/search/users` | Auth (admin) | `q` |
| GET | `/admin/free-rotation/users/:id/songs` | Auth (admin) |  |
| PATCH | `/admin/free-rotation/songs/:id` | Auth (admin) |  |
| GET | `/admin/free-rotation/songs` | Auth (admin) | `radio` |
| POST | `/admin/live/start` | Auth (admin) |  |
| POST | `/admin/live/stop` | Auth (admin) |  |
| GET | `/admin/live/status` | Auth (admin) |  |
| GET | `/admin/feed-media` | Auth (admin) | `reportedOnly` |
| PATCH | `/admin/feed-media/:contentId/remove` | Auth (admin) |  |
| DELETE | `/admin/feed-media/:contentId` | Auth (admin) |  |
| GET | `/admin/reports/posts` | Auth (admin) |  |
| GET | `/admin/reports/users` | Auth (admin) |  |
| GET | `/admin/reports/content` | Auth (admin) |  |
| POST | `/admin/reports/content/:id/remove` | Auth (admin) |  |
| POST | `/admin/reports/content/:id/dismiss` | Auth (admin) |  |
| DELETE | `/admin/discover-feed-posts/:postId` | Auth (admin) |  |
| POST | `/admin/app-releases` | Auth (admin) | Publish a version; optional broadcast push |
| POST | `/admin/emails/testflight-beta` | Auth (admin) |  |
| POST | `/admin/chat/toggle` | Auth (admin) |  |
| POST | `/admin/chat/shadow-ban/:userId` | Auth (admin) |  |
| POST | `/admin/chat/unban/:userId` | Auth (admin) |  |
| GET | `/admin/chat/shadow-banned` | Auth (admin) |  |
| DELETE | `/admin/chat/messages/:messageId` | Auth (admin) |  |
## `/radio/current` payload

`GET /radio/current` and `GET /radio/next` return the song row plus timing and score fields:

- **Timing:** `is_playing`, `started_at`, `server_time`, `time_remaining_ms`, `position_seconds`, `duration_seconds`. `stale: true` marks a cached snapshot.
- **Play:** `play_id` (current `plays.id`, used for voting; `null` until a listener is present on the station), `listener_count`, `is_fallback`, `credits_deducted` (on an advance).
- **Scores:** `fire_votes`, `shit_votes`, `total_votes`, `temperature_percent` (0–100, starts at 50), `popular_temperature_percent`, `peer_temperature_percent`, `popular_rating_avg`, `peer_rating_avg`.
- **Extras:** `pinned_catalysts` (Catalyst credits), `artist_live_now` (`{ sessionId, status, currentViewers }` when the artist is streaming), `is_live`, `trial_by_fire_active`.
- **Empty station:** `no_content: true` with a `message`, or `degraded: true` when the server replays the last good song or a station jingle.

## Realtime (Supabase)

Clients subscribe with `supabase-js` / `supabase_flutter`:

- **Station channel** `dj-booth:{stationId}` (broadcast, event `dj_booth_event`): `queue_updated`, `transport_pause`, `transport_play`, `mic_on`, `mic_off`, `duck_volume`, `soundboard_play`. Clients refetch `/radio/current` on `queue_updated`.
- **Live Chat channel** `radio-chat:{stationId}` (broadcast): `new_message`, `emoji_burst`, `message_deleted`.
- **`public.station_events`** `INSERT` with `type = 'rising_star'` (published to `supabase_realtime` in migration 130) drives the Butterfly Ripple banner.
- **`public.likes`** / **`public.leaderboard_likes`** `INSERT` feed Ripple visuals; `leaderboard_likes` is the authoritative per-play vote table.
