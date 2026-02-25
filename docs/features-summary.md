# NETWORX — Full Feature Summary

**Product name:** NETWORX Radio: The Butterfly Effect  
**Tagline:** By artists, for artists.

This document is a single reference for all platform features across web, mobile, and backend. For terminology (Prospectors, Ripples, Ores, The Wake, The Yield, etc.), see [branding-terminology.md](branding-terminology.md). For API details, see [api-spec.md](api-spec.md).

---

## 1. Live Radio & Playback

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Synchronized radio** | Everyone hears the same stream; shared “LIVE” state across clients | ✅ | ✅ | Redis + `/radio/current`, `/radio/next` |
| **Continuous playback** | Auto-advance, no user skip in core radio; deterministic shuffle | ✅ | ✅ | Radio service + play decision log |
| **Radio controls** | Play/pause, volume, now-playing metadata | ✅ | ✅ | — |
| **Background / persistent playback** | Radio continues in other tabs (web) and when app is backgrounded (mobile) | ✅ | ✅ | — |
| **Heartbeat (proof-of-listening)** | 30s listening heartbeat for Prospectors; gates Yield and play verification | ✅ | ✅ | `POST /radio/heartbeat` |
| **Play reporting** | Logs plays for rotation and analytics | ✅ | ✅ | `POST /radio/play` |

---

## 2. Artist Content & Rotation

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Song upload** | Secure uploads (signed URLs), artwork, server-side validation | ✅ | ✅ | Uploads service + Supabase Storage |
| **Moderation workflow** | Pending → Approve / Reject; admin song management | ✅ | — | Admin + songs status |
| **Trial rotation** | Newly approved tracks get free trial plays before paid rotation | — | — | Radio selection logic |
| **Paid rotation (credits)** | Artists allocate credits to tracks for airtime; atomic pre-charge before play | ✅ | ✅ | Credits + radio service |
| **Play decision log** | Transparent logging of why a track was selected (auditability) | — | — | `play_decision_log` table |
| **Fallback playlist** | Admin-managed fallback when queue is empty | ✅ | — | Admin fallback + free-rotation |
| **Artist discography (profile)** | Spotify-like discography on artist profile; unlimited listens; like/unlike per song | ✅ | ✅ | Songs + profile listens |
| **Profile listens** | Countable listens from discography player (30s threshold); combined with radio plays for popularity | ✅ | — | `POST /songs/:id/profile-listen`, `song_profile_listens` |
| **Popularity weighting** | Radio selection can favor combined listens + likes (with caps) | — | — | Radio service |

---

## 3. Engagement & Ripples

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Ripples (persistent likes)** | Like/unlike on artist profile discography; drives leaderboard “By Ripples” | ✅ | ✅ | `POST/DELETE /songs/:id/like`, `songs.like_count` |
| **Vote once per play (radio)** | While a track is on air, each listener can vote once per play (no unlike); same track again = vote again | ✅ | ✅ | `POST /leaderboard/songs/:id/like` with `playId` |
| **Play ID on radio** | Current play row id returned in `GET /radio/current` for per-play voting | — | — | Radio state + plays table |
| **Realtime Ripple visuals** | Live Ripple + Global Vote Map on listen page (Supabase Realtime `likes` INSERT) | ✅ | — | Supabase Realtime |
| **Rising Star / Butterfly Ripple** | When a track hits ~5% conversion during its play, “Rising Star” event; web pulse overlay, mobile haptic + ripple animation | ✅ | ✅ | `station_events`, leaderboard service |

---

## 4. Competition & Leaderboards

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **By Ripples** | Leaderboard ranked by persistent `songs.like_count` | ✅ | ✅ | `GET /leaderboard/songs?by=likes` |
| **By discoveries (listens)** | Combined radio + profile listens | ✅ | ✅ | `GET /leaderboard/songs?by=listens` |
| **Trial by Fire** | Ranking by upvotes per minute in a time window | ✅ | ✅ | `GET /leaderboard/upvotes-per-minute` |
| **Trial-by-Fire window** | Configurable daily window; “Live” indicator switches to Radioactive Lime when active | ✅ | ✅ | Env + `trial_by_fire_active` in radio payload |
| **Daily Diamond** | Snapshot of winner at end of Trial-by-Fire window (cron + `daily_diamonds` table) | — | — | Daily diamond cron service |
| **Spotlight / Top 7** | Featured tracks and vote surfaces | ✅ | ✅ | Competition + spotlight modules |

---

## 5. Live Chat & Social

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Live radio chat** | Real-time chat during listening (Supabase Realtime) | ✅ | ✅ | Chat service + Supabase |
| **Emoji reactions** | Reactions in chat | ✅ | ✅ | Emoji controller + aggregation |
| **Chat archival** | Scheduled cleanup (e.g. 24h) | — | — | Tasks module |

---

## 6. Artist Livestream (Twitch-style)

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Go live** | Artist starts a live stream (e.g. Cloudflare Stream live input) | ✅ | ✅ | `POST /artist-live/start` |
| **Stop live** | End stream; lifecycle via webhook | ✅ | ✅ | `POST /artist-live/stop` + webhook |
| **Watch live** | Viewers join stream (HLS/low-latency player) | ✅ | ✅ | `GET /artist-live/:artistId/watch` |
| **Live status** | Is artist live, viewer count, session id | ✅ | ✅ | `GET /artist-live/:artistId/status` |
| **Join session** | Record viewer join for presence/peak | ✅ | ✅ | `POST /artist-live/:sessionId/join` |
| **Go-live nudge** | Notify artist when their song is on air (prompt to go live) | — | — | Radio + push notification service |
| **Listener fanout** | When artist goes live during their song, notify current radio listeners | — | — | Push + prospector sessions |
| **Artist page live entry** | “Live now” badge, viewer count, “Watch live” / “Go live” / “End live” on artist profile | ✅ | ✅ | — |
| **Radio player live link** | “Join artist live” when current track’s artist is live | ✅ | — | RadioPlayer + artistLiveNow |
| **Stream donations** | Donation intent (Stripe) + ledger; min/max, idempotency, feature flag | ✅ | ✅ | Payments + artist-live |
| **Stream moderation** | Admin force-stop, artist live ban; report stream → in-app notification | ✅ | — | Artist-live service + admin |
| **Ad impression tracking** | Placeholder for stream ad tracking (feature flag) | — | — | Artist-live + stream_ad_impressions |

---

## 7. Notifications

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Up Next** | Notify artist when their track is coming up | — | ✅ | Push notification service |
| **Live Now** | Notify artist when their track is playing | — | ✅ | Push notification service |
| **FCM push** | Mobile push via Firebase Cloud Messaging | — | ✅ | Push notification module |
| **In-app notifications** | Notification center (web dashboard) | ✅ | ✅ | Notifications API + UI |
| **Creator Network events** | New message, job application, content liked | ✅ | ✅ | Notifications + creator-network |

---

## 8. The Yield (Prospector Rewards)

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Yield balance** | Prospector balance (cents), tier, ores refined count | ✅ | ✅ | `GET /prospector/yield`, `GET /yield/balance` |
| **Check-in** | Anti-bot check-in (Ripple tap); gates Yield accrual | ✅ | ✅ | `POST /prospector/check-in` |
| **Refinement** | Score song 1–10 in Refinery; idempotent; credits Yield | ✅ | ✅ | `POST /prospector/refinement` |
| **Survey** | Survey responses for Refinery song; credits Yield | ✅ | ✅ | `POST /prospector/survey` |
| **Redemption** | Redeem balance for $5 / $10 Virtual Visa (etc.); atomic, idempotent (`request_id`) | ✅ | ✅ | `POST /yield/redeem`, `redeem_prospector_yield` RPC |
| **Rewards Command Center** | Progress to $5/$10, redeem buttons, history | ✅ | ✅ | Yield page + mobile Yield screen |

---

## 9. The Refinery (Prospector Portal)

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **List Refinery songs** | Songs submitted by artists for review | ✅ | ✅ | `GET /refinery/songs` |
| **Add/remove from Refinery** | Artist adds/removes own song | ✅ | — | `POST /refinery/songs/:id/add|remove` |
| **Unlimited listens** | Prospectors can play Refinery songs unlimited times | ✅ | ✅ | — |
| **Rank (1–10)** | Refinement score per user/song | ✅ | ✅ | Refinement endpoint |
| **Comments** | Prospector comments on Refinery songs | ✅ | ✅ | `GET|POST /refinery/songs/:id/comments` |
| **Rewards** | Refinement/survey credit Yield | — | — | Prospector refinement + Yield |

---

## 10. Credits & Payments

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Credit balance** | Artist credit balance and history | ✅ | ✅ | `GET /credits/balance` |
| **Buy credits** | Stripe PaymentIntent (mobile) or Checkout (web) | ✅ | ✅ | Payments service |
| **Allocate credits** | Assign credits to a track for airtime | ✅ | ✅ | Credits allocation |
| **Buy song plays** | Per-song play packs (pricing API + intent) | ✅ | ✅ | `GET /payments/song-play-price`, create-intent-song-plays |
| **Quick Add 5 Minutes** | Fixed quick-buy during airtime | ✅ | ✅ | `POST /payments/quick-add-minutes` |
| **Transactions** | User transaction history | ✅ | ✅ | `GET /payments/transactions` |
| **Stripe webhooks** | Payment and subscription events | — | — | `POST /payments/webhook` |
| **Creator Network subscription** | Stripe subscription for DMs and premium features | ✅ | ✅ | Checkout + webhook (subscription created/updated/deleted) |

---

## 11. The Wake (Analytics)

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Artist analytics summary** | Plays, likes, top songs, daily plays | ✅ | ✅ | `GET /analytics/me` |
| **ROI** | ROI metric over configurable days | ✅ | ✅ | `GET /analytics/me/roi` |
| **Listener heatmap (proxy)** | Plays/listeners by region (profile-click engagement) | ✅ | ✅ | `GET /analytics/me/plays-by-region` |
| **Discoverable toggle** | Prospector can opt out of heatmap (discoverable/incognito) | ✅ | ✅ | `users.discoverable`, `PUT /users/me` |

---

## 12. Discovery & Pro-Directory

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Discover people** | List service providers/artists with filters (role, service type, search, location, radius) | ✅ | ✅ | `GET /discovery/people` |
| **Nearby (location)** | PostGIS-based nearby providers; location permission + radius UI | — | ✅ | Discovery service + `get_provider_ids_nearby` |
| **Provider profile** | Service provider profile, listings, portfolio | ✅ | ✅ | `GET /service-providers/:userId` |
| **Pro-NETWORX directory** | Separate app (pro-web) with skills, availability, Fiverr-style cards | ✅ | ✅ | Pro-networx module + pro-web app |
| **Pro-NETWORX profile** | Sync-Profile (LinkedIn-style), skills, headline, available for work | ✅ | ✅ | `GET|PUT /pro-networx/me/profile`, directory |
| **Pro-NETWORX onboarding** | First-run skills + availability | ✅ | — | Pro-networx API |

---

## 13. Messaging & Creator Network

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **DMs (conversations)** | Thread list and thread view | ✅ | ✅ | Service-messages API |
| **Creator Network paywall** | Sending messages requires active Creator Network subscription | ✅ | ✅ | Service-messages service |
| **Job board** | Service requests and applications | ✅ | ✅ | Job-board module |
| **Pro-NETWORX messages** | Same DM backend; re-skinned in pro-web | ✅ | — | Service-messages |

---

## 14. Venue & Sponsorship

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Venue Partner slot** | Current venue ad (visual sponsorship) on listen/player | ✅ | ✅ | `GET /venue-ads/current` |
| **No audio ads on radio** | Core radio stream has no interrupting audio ads | — | — | Product policy |
| **Visual / artist-page ads** | Visual ads and optional sponsor placements on artist pages | — | — | Placeholder / future |

---

## 15. Admin

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Song moderation** | Approve, reject, delete songs (DB + storage) | ✅ | — | Admin + songs |
| **User management** | Roles, lifetime ban, deactivate | ✅ | — | Admin users |
| **Fallback playlist** | Upload songs, add from free-rotation DB | ✅ | — | Admin fallback |
| **Free rotation** | Toggle songs in/out of free rotation | ✅ | — | Admin free-rotation |
| **Radio queue / override** | View queue, override next track | ✅ | — | Admin radio |
| **Analytics** | Platform-wide stats | ✅ | — | `GET /admin/analytics` |
| **Artist live moderation** | Force-stop stream, set artist live ban | ✅ | — | Artist-live admin |

---

## 16. Auth & Security

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Firebase Auth** | Email/password, Google, Apple | ✅ | ✅ | Firebase client + Admin |
| **Session cookies (web)** | HTTP-only session cookie for SSR/dashboard | ✅ | — | `POST /api/auth/login|logout` |
| **Bearer token (API)** | `Authorization: Bearer <idToken>` for /api/* | ✅ | ✅ | Firebase Auth guard |
| **Role-based access** | listener, artist, service_provider, admin | ✅ | ✅ | Guards + profile |

---

## 17. Infrastructure & Observability

| Feature | Description |
|--------|-------------|
| **Redis** | Radio state, listener counts, emoji aggregation |
| **Supabase** | PostgreSQL (users, songs, plays, credits, yield, refinery, artist-live, etc.), Realtime, Storage |
| **Structured logging** | Winston JSON logging |
| **Request ID** | Tracing middleware |
| **Sentry** | Error reporting |
| **PWA** | Web manifest, service worker, offline fallback (`/~offline`) |

---

## 18. Feature Flags (examples)

- `ARTIST_LIVE_ENABLED` — Artist livestream on/off  
- `STREAM_DONATIONS_ENABLED` — Stream donation flow  
- `STREAM_ADS_TRACKING_ENABLED` — Stream ad impression tracking  
- Trial-by-Fire window: `TRIAL_BY_FIRE_START_UTC`, `TRIAL_BY_FIRE_DURATION_MIN`  
- Cloudflare Stream: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, optional webhook secret  

---

*Last updated: February 2026. For changelog see [changelog/2026-02.md](changelog/2026-02.md).*
