# NETWORX — Full Feature Summary

**Product name:** NETWORX Radio: The Butterfly Effect  
**Tagline:** By artists, for artists.

This document is a single reference for all platform features across web, mobile, and backend. NETWORX ships two products from one codebase: **NETWORX Radio** (listeners and artists, https://www.networxradio.com) and **Pro-Networx** (professional network and services marketplace for creators and Catalysts, https://www.pro-networx.com). For terminology (Prospectors, Ripples, Songs, The Wake, The Yield, etc.), see [branding-terminology.md](branding-terminology.md). For API details, see [api-spec.md](api-spec.md).

**Who uses what:** listeners (Prospectors), artists (Gems), DJs and musicians who go live, Catalysts (service providers), and admins. An account can hold more than one maker role (`users.user_roles`: artist, service_provider, musician, dj).

---

## 1. Live Radio & Playback

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Synchronized radio** | Everyone on a station hears the same song at the same position; shared "LIVE" state | ✅ | ✅ | Redis `radio:{stationId}:*` + `GET /radio/current`, `/radio/next` |
| **Multiple stations** | Genre stations (Ready Now, New School / Old School / Clean Rap, Hip Hop, R&B, Pop, Rock, Metal, Country, EDM, Kids Friendly, Podcasts, and more); the player reopens the last station | ✅ | ✅ | Station-scoped queues and state |
| **Hard live sync** | Playing clients follow the server's current song and position; station switches cannot be overwritten by the previous station | ✅ | ✅ | `web/src/lib/radio-sync.ts`, `mobile/lib/core/radio/radio_sync.dart` |
| **Continuous playback** | Auto-advance with server-driven rotation; listeners cannot skip core radio | ✅ | ✅ | Radio service + play decision log |
| **Mute that sticks** | Mute/unmute stays on through song changes and station switches; radio auto-mutes while a clip, feed video, livestream, or Refinery song plays | ✅ | ✅ | — |
| **Full player** | Album art with tilt and fire/poop reaction effects, synced lyrics, Up Next queue, equalizer bars, song stories, share menu | ✅ | ✅ | — |
| **Mini player / bottom bar** | Persistent glass radio bar across the app; web bar shows fire and poop votes; mobile bar opens the full player on a drag, and a downward swipe closes it | ✅ | ✅ | — |
| **Background playback** | Radio keeps playing in other tabs (web) and when the app is backgrounded (mobile) | ✅ | ✅ | — |
| **Lock screen / Now Playing** | Media session with cover art; iOS Now Playing widget and Live Activity (Dynamic Island) with mute and fire/pass votes | ✅ (media session) | ✅ | — |
| **Android Auto** | Station list in Android Auto | — | ✅ | — |
| **Listening tools** | Sleep timer, recent listening, and favorites saved on the phone (Settings → Listening) | — | ✅ | `GET/POST /growth/history`, `GET /growth/favorites` |
| **Heartbeat (proof-of-listening)** | Listening heartbeat for Prospectors; gates Yield and play verification | ✅ | ✅ | `POST /radio/heartbeat`, `POST /radio/presence` |
| **Play reporting** | Logs plays for rotation and analytics | ✅ | ✅ | `POST /radio/play` |

---

## 2. Artist Content & Rotation

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Song upload** | Direct-to-storage uploads with progress, artwork, server-side validation; lossless uploads are transcoded to MP3 | ✅ | ✅ | `POST /songs/upload-url`, `POST /songs`, `uploads/audio-transcode.service.ts` |
| **Auto-promote to artist** | A listener who uploads a song or saves a Pro profile becomes an artist | ✅ | ✅ | `users/promote-listener.ts` |
| **Full-Song Radio Opt-In** | Required radio streaming authorization + optional DJ livestream / archived-mix flags; optional Pro-Radio opt-in | ✅ | ✅ | `opt_in_full_song_radio`, DJ flags; legal page `/full-song-radio-opt-in` |
| **Albums** | Group uploads into albums shown on the artist page | ✅ | ✅ | `albums` module (`/albums/mine`, tracks) |
| **Synced lyrics** | Artist lyrics force-aligned or auto-transcribed (ElevenLabs); free scrolling with the current line highlighted | ✅ | ✅ | `song_lyrics`, `lyrics` module |
| **Copyright scanning** | ACRCloud match on upload; uploaders see the matched title in-app; admin bulk scan, filter, and badges | ✅ | ✅ | `copyright` module, `POST /songs/admin/backfill-copyright` |
| **Moderation workflow** | Pending → Approve / Reject with reasons; admin song management | ✅ | ✅ | Admin + songs status |
| **Trial rotation** | Newly approved songs get 3 free plays before placements are required | — | — | `getTrialSong()`, `songs.trial_plays_remaining` (default 3) |
| **Rotation tiers** | In paid mode: placement-funded songs → trial songs → free-rotation songs whose trial is used up → station free rotation. Paid mode starts at `THRESHOLD_ENTER_PAID` listeners and ends at `THRESHOLD_EXIT_PAID` | — | — | `radio.service.ts` |
| **Discovery placements** | Artists buy placements per song from My Songs; each placement adds 100 exposures (plays) to the song's rotation budget | ✅ | ✅ | `songs.credits_remaining`, `EXPOSURES_PER_PLACEMENT`, `deduct_play_credits` RPC |
| **Welcome placements** | Artists and producers receive 10 free placements at signup and choose how to split them across songs | ✅ | ✅ | `POST /credits/songs/:songId/apply-welcome-placements` |
| **Play decision log** | Records why each track was selected (auditability); pruned on a schedule | — | — | `play_decision_log` table, `tasks/cleanup.service.ts` |
| **Fallback playlist** | Admin-managed fallback per station when the queue is empty | ✅ | ✅ (admin) | Admin fallback + free-rotation |
| **Artist discography** | Discography on the artist profile with unlimited listens, like, favorite, add to playlist; songs sort the same way everywhere | ✅ | ✅ | Songs + profile listens |
| **Profile listens** | Countable listens from the discography player; combined with radio plays for popularity | ✅ | ✅ | `POST /songs/:id/profile-listen`, `song_profile_listens` |
| **Fan email list** | Listeners join an artist's email list from the artist page; artists view their list (mobile Studio) | ✅ (join) | ✅ | `POST /fans/:artistId`, `GET /fans/me` |
| **Song sales & payouts** | Artists sell songs/beats; balances pay out through Stripe Connect once the account can receive funds | ✅ | ✅ | `POST /payments/songs/:songId/checkout`, `/payments/connect/*` |

---

## 3. Engagement & Ripples

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Ripples (likes)** | Like/unlike songs; drives "By Likes" leaderboard and library | ✅ | ✅ | `POST/DELETE /songs/:id/like` |
| **Song favorites (stars)** | Star a song separately from fire likes; favorites list in the library | ✅ (view/remove) | ✅ | `POST/DELETE /songs/:id/favorite`, `GET /songs/favorites` |
| **Favorite artists** | Favorite an artist to get radio-only alerts when they play | — | ✅ | `POST/DELETE /users/:id/favorite` |
| **Radio reactions** | Per-play **fire** / **poop** vote with an album aura or splat effect; one vote per play, changeable | ✅ | ✅ | `POST /leaderboard/songs/:id/like` + `reaction` |
| **1–10 rating** | Rate the song on air from the player's more menu | ✅ | ✅ | `GET/POST /songs/:id/rating`, `song_listener_ratings` |
| **Popular vs peer scores** | Song temperature and rating split into popular (listener) and peer (maker) scores; votes with no listen or burst spam are excluded and flagged for admin | ✅ | ✅ | `song_temperature`, `common/vote-integrity.ts`, `activity_flags` |
| **Song reports** | Report a song with a reason from the player | ✅ | ✅ | `POST /moderation/reports` |
| **Song stories** | Record a clip of the song on air (hold-to-record camera, artist-credit sticker, text) and post it as a 24-hour story: public (shows on the radio while the song plays), private (friends), or hidden; owners delete, others report | ✅ (Pro-Radio recorder) | ✅ | `song-stories` module |
| **Clip sharing** | Send a clip in DMs, share to Instagram, or use the share sheet | ✅ | ✅ | `messages/upload-url` |
| **Rising Star / Butterfly Ripple** | Station event when a track hits ~5% conversion during its play; web pulse overlay, mobile haptic + ripple | ✅ | ✅ | `station_events` (Realtime) |

---

## 4. Competition & Leaderboards

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Leaderboards** | By likes, by listens, positive votes, best fire/poop ratio, most saves | ✅ | ✅ | `GET /leaderboard/songs?by=likes|listens|positive_votes|ratio|saves` |
| **Votes per minute (Trial by Fire)** | Ranking by votes per minute in a time window | ✅ | ✅ | `GET /leaderboard/upvotes-per-minute` |
| **Trial-by-Fire window** | Configurable daily window; live indicator changes while active | ✅ | ✅ | `TRIAL_BY_FIRE_*` env + `trial_by_fire_active` in radio payload |
| **Daily Diamond** | Snapshot of the winner at the end of the Trial-by-Fire window | — | — | `tasks/daily-diamond-cron.service.ts` |
| **Weekly Top 7 vote** | Listeners vote for the week's Top 7; weekly, monthly, and yearly winners | ✅ | ✅ | `competition` module + `competition-cron.service.ts` |
| **Spotlight** | Featured artist of the day / week with unlimited listens | ✅ | ✅ | `spotlight` module |

---

## 5. Chat, Feed & Social

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Live Chat** | Station-wide real-time chat during listening; The Chat Room page with an album-art or butterfly backdrop | ✅ | ✅ | `chat` module + Supabase Realtime |
| **Song Comments** | Per-song comment thread beside Live Chat; comments return the next time the song plays | ✅ | ✅ | `GET /chat/comments` |
| **Emoji reactions** | Reactions in chat | ✅ | ✅ | `POST /chat/emoji` |
| **Chat archival** | Hourly archive of messages older than 24h | — | — | `tasks/cleanup.service.ts`, `archive_old_chat_messages` |
| **Feed posts** | Photo, video (up to 5 minutes), and audio posts with optional cover; like, comment, bookmark, report; full-screen video with swipe to close | ✅ | ✅ | `discovery/feed*` endpoints |
| **Follow / followers** | Follow users and artists; followers, following, friends lists | ✅ | ✅ | `/users/:id/follow*`, `/artists/:artistId/follow` |
| **Block / report users** | Block, unblock, report; Settings → Blocked accounts | ✅ | ✅ | `/users/:id/block`, `/users/:id/report`, `GET /users/me/blocks` |
| **Invite friends** | Invite by text, email, or the share sheet; referral codes | — | ✅ | `GET /growth/referrals/me`, `POST /growth/referrals/claim` |
| **Artist profile sharing** | Share links open `https://www.networxradio.com/open/artists/:id`; guests can view the page, which offers "Open in the NetworX app" | ✅ | ✅ | Public artist endpoints; App Links / Universal Links |
| **Radio share links** | Share the station on air or the artist playing | ✅ | ✅ | `/radio/[stationId]`, `/song/[id]` |

---

## 6. Livestream, Live DJ & DJ Booth

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Streamer approval** | Users request streaming access; admin approves in Admin → Streamers or grants it in Admin → Users | ✅ | ✅ | `GET /artist-live/streamer-status`, `POST /artist-live/apply`, `/admin/streamer-applications` |
| **Go live** | Approved streamers go live as a DJ or musician (camera or audio-only, WHIP publish); Go live shows only on your own artist profile | ✅ | ✅ | `POST /artist-live/start`, `/publishing` (Cloudflare Stream) |
| **Live DJ / Live Performances** | Separate listings for DJ sets and live performances | ✅ | ✅ | `GET /artist-live/sessions` |
| **Watch live** | WHEP playback; radio pauses while watching | ✅ | ✅ | `GET /artist-live/:artistId/watch` |
| **Stream chat** | Chat on the stream; removals sync to every viewer | ✅ | ✅ | `/artist-live/:sessionId/chat` |
| **Stream donations** | Donation intent / checkout (feature flag) | ✅ | ✅ | `/artist-live/:sessionId/donations/*` |
| **Go-live nudge & listener fanout** | Artist is nudged to go live when their song is on air; current listeners are notified when they do | — | ✅ (push) | Radio + push service |
| **Radio player live link** | "Join artist live" when the current track's artist is live | ✅ | ✅ | `artist_live_now` in radio payload |
| **Stream moderation** | Admin force-stop; report a stream | ✅ | ✅ | `POST /artist-live/admin/sessions/:id/force-stop`, `/:sessionId/report` |
| **Admin DJ Booth** | Station transport (play/pause/back/skip), queue edits, mic talk-over with ducking and headphone monitoring, soundboard clips | ✅ | ✅ | `admin/dj-booth` module |

---

## 7. Notifications

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Up Next** | Artist is told their song plays in about 5 minutes and 1 minute (4-hour cooldown, daily cap) | — | ✅ | `scheduleUpcomingPlayNotification()` |
| **Live Now** | Artist is told their song is playing | — | ✅ | `sendLiveNowNotification()` |
| **Followed / favorite artist alerts** | Followers hear when an artist is up next, on air, or uploads a new song | — | ✅ | `notifyFollowersArtist*()` |
| **Social alerts** | New follower, song liked, feed post liked, new message, message request | ✅ (in-app) | ✅ | Notifications + push |
| **FCM push** | Firebase Cloud Messaging with APNs; pushes queued with BullMQ; taps deep-link to the player, analytics, watch live, DMs, or profiles | — | ✅ | `push-notifications` module, `push-queue.service.ts` |
| **App update prompts** | Soft/force update from `app_releases`; admin can broadcast | — | ✅ | `GET /app/version`, `POST /admin/app-releases` |
| **In-app inbox** | Notification center with unread badge, mark read, delete | ✅ | ✅ | `notifications` module |
| **Notification preferences** | Followed-artist radio alerts (web and mobile); per-type toggles on mobile | ✅ | ✅ | `PUT /users/me`, `GET/PATCH /growth/notifications` |

---

## 8. The Yield (Prospector Rewards)

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Yield balance** | Prospector balance (cents), tier, songs refined count | ✅ | ✅ | `GET /prospector/yield` |
| **Check-in** | Anti-bot check-in; gates Yield accrual | ✅ | ✅ | `POST /prospector/check-in` |
| **Refinement & survey** | Score a song 1–10 and answer surveys; credits Yield | ✅ | ✅ | `POST /prospector/refinement`, `POST /prospector/survey` |
| **Redemption** | Redeem for a $5, $10, or $25 Virtual Visa; atomic and idempotent | ✅ | ✅ | `POST /yield/redeem`, `redeem_prospector_yield` RPC |
| **Rewards page** | Progress, redeem buttons, history (More → Rewards) | ✅ | ✅ | `/yield` |

---

## 9. The Refinery

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Submit a song** | Artists add a song, answer required questions, and pay the submission fee (Stripe on web, store purchase on mobile) | ✅ | ✅ | `POST /refinery/songs/:id/submit|add|remove` |
| **Reviewer signup** | Listeners sign up as Refinery reviewers | ✅ | ✅ | `POST /refinery/reviewer/signup` |
| **Review queue & form** | Reviewers play songs (with seeking) and complete the review form; each review credits Yield | ✅ | ✅ | `GET /refinery/songs`, `/songs/:id/review-form`, `POST /songs/:id/review` |
| **Artist analytics** | Per-song review analytics; artists favorite and quality-rate reviews | ✅ | ✅ | `GET /refinery/songs/:id/analytics`, `/reviews/:reviewId/favorite|quality` |
| **Comments** | Comments on Refinery songs | ✅ | ✅ | `GET|POST /refinery/songs/:id/comments` |

---

## 10. Placements, Subscriptions & Payments

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Buy placements** | Per-song placement packs with bonus placements on larger packs; Stripe Checkout on web, App Store / Google Play purchase on mobile | ✅ | ✅ | `GET /payments/song-play-price`, `checkout-session-song-plays`, `app-store/complete`, `google-play/complete` |
| **Pro-Networx subscription** | Unlocks DMs and resumes on Pro-Networx | ✅ | ✅ | `create-pro-networx-*`, `GET /pro-network-subscription/access` |
| **Pro-Radio subscription** | Unlocks on-demand Pro-Radio | ✅ | ✅ | `create-pro-radio-*`, `GET /pro-radio-subscription/access` |
| **Pro bundle** | Pro-Networx + Pro-Radio together | ✅ | ✅ | `create-pro-bundle-*` |
| **Store billing on mobile** | Digital goods on iOS/Android go through App Store / Play Billing; failed backend calls are retried from a pending purchase queue | — | ✅ | `store-billing-policy.ts`, App Store notifications, Play RTDN |
| **Beta access** | `BETA_ALL_FREE=true` unlocks subscription features for a test window (welcome placements stay locked while it is on) | ✅ | ✅ | `common/beta-access.ts` |
| **Transactions** | Purchase history | ✅ | ✅ | `GET /payments/transactions`, `GET /credits/transactions` |
| **Stripe webhooks** | Payment, subscription, and refund events | — | — | `POST /payments/webhook` |

The old credit bank (buy credits, then allocate to songs) is retired. `/artist/songs/[id]/allocate` on web redirects to Buy placements.

---

## 11. The Wake (Analytics)

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Artist analytics** | Listens, plays, likes, top songs (sortable by plays, views, likes, name, recency), daily plays; song and profile picker | ✅ | ✅ | `GET /analytics/me`, `GET /analytics/songs/:id` |
| **Ears reached** | Unique people reached; unique listeners counts every listen | ✅ | ✅ | `unique_listeners` migration 139 |
| **New followers** | Follower growth over the period | ✅ | ✅ | `GET /analytics/me/roi` |
| **Listener heatmap** | Plays by region | ✅ | ✅ | `GET /analytics/me/plays-by-region` |
| **Discover swipe stats** | Right/left swipes and average decision time | ✅ | ✅ | `GET /analytics/me/discover-swipes` |
| **Home stats** | Artists see their own stats with platform totals in a second bar | ✅ | ✅ | `GET /analytics/platform`, `/platform/live` |
| **Discoverable toggle** | Prospectors can opt out of the heatmap | ✅ | ✅ | `users.discoverable`, `PUT /users/me` |

---

## 12. Discover, Search & Studios

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Discover swipe** | Swipe song clips (like / skip, play between), cards fly off screen; reshuffle; forgive swipes | ✅ | ✅ | `GET /songs/discover/feed`, `POST /songs/discover/swipe` |
| **Discover artists** | Glass artist cards sorted Popular / Most songs / Recent | ✅ | ✅ | `GET /songs/artists/search`, `GET /discovery/people` |
| **Artist scope** | Everyone (default) / Following / Liked | — | ✅ | `GET /songs/discover/liked-artists` |
| **Discover library** | Liked, disliked, favorites, playlists | ✅ | ✅ | `/songs/discover/list`, `/songs/library`, `/songs/favorites` |
| **Create video** | Record a selfie video to a liked clip with countdown, preview, and re-record | ✅ | ✅ | Feed upload endpoints |
| **Search** | Search as you type across songs, artists, and people; artist results as glass cards with sort, scope, and genre filters | ✅ (Discover → Artists) | ✅ | `GET /growth/search`, `GET /songs/artists/search` |
| **People directory & map** | Find artists and Catalysts by role, service, location; heat map and clusters at a general vicinity | ✅ | ✅ | `/discovery/people/directory`, `/discovery/map/*` |
| **Studios** | Studio directory with rate cards and photo uploads; studio pages; owners edit My Studio | ✅ | ✅ | `studios` module |
| **Nearby** | Studios near you as a list or map, pinned by ZIP with distorted locations | ✅ | ✅ | `/studios`, `/discovery/people/directory` |
| **Suggestions** | Local and genre artist suggestions | ✅ | — | `/suggestions/local-artists`, `/suggestions/genre-artists` |

---

## 13. Pro-Networx

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Pro home** | Discover Creatives with type filters; each artist's radio catalog shows on Pro-Networx | ✅ | ✅ | `pro-networx` module |
| **Pro feed & explore** | Creator posts, explore detail, saved and liked posts; portfolio stays on the creator's own posts | ✅ | ✅ | `discovery/feed/explore*` |
| **Pro profile** | Headline, skills, availability, social links, services rail, Follow, Message, Share (Text / Send in a DM); public at `/pro-networx/u/:id` for signed-out visitors | ✅ | ✅ | `/pro-networx/profiles/:userId`, `/pro-networx/public/profiles/:userId` |
| **Onboarding** | First-run skills and availability form | ✅ | — | `PUT /pro-networx/me/profile` |
| **Services** | Catalyst service listings, service detail, My services | ✅ | ✅ | `/pro-networx/services`, `/pro-networx/me/services` |
| **Beats** | Beat marketplace | ✅ | ✅ | `GET /songs/beats/marketplace` |
| **Projects (job board)** | Post requests and apply | ✅ | ✅ | `job-board` module |
| **Resumes** | Resume upload; viewing is subscription-gated | ✅ | ✅ | `/pro-networx/me/resume` |
| **Pro search & directory** | Search creatives, services, beats, studios as you type | ✅ | ✅ | `/pro-networx/directory` |
| **Switch apps** | Move between Radio and Pro-Networx without signing in again | ✅ | ✅ | `/auth/cross-domain-token`, `/auth/cross-domain-exchange` |

---

## 14. Messages (DMs)

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Conversations** | Thread list and thread view with typing indicator, read state, reactions, edit, unsend, media | ✅ | ✅ | `messages` controller (`service-messages` module) |
| **Message requests** | Messages from people you don't follow land in Requests until accepted | ✅ | ✅ | `POST /messages/conversations/:id/accept` |
| **Message buttons** | Message from artist and Pro profiles; guests are asked to sign in first | ✅ | ✅ | — |

---

## 15. Pro-Radio

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **On-demand hub** | Play full songs on demand from opted-in catalog | ✅ | ✅ | `GET /playlists/catalog` |
| **Playlists** | Create, rename, reorder, remove tracks; + playlist button on radio, artist, Discover, and library | ✅ | ✅ | `playlists` module |
| **Clip recorder** | Record any moment of a full song as a clip or story | ✅ | ✅ | `song-stories` |

---

## 16. Venue & Sponsorship

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Venue Partner slot** | Current venue ad on the player | — | ✅ | `GET /venue-ads/current` |
| **No audio ads on radio** | The radio stream has no interrupting audio ads | — | — | Product policy |

---

## 17. Admin

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Song moderation** | Approve, reject, delete, trim, edit metadata and stations, copyright filter | ✅ | ✅ | `/admin/songs*` |
| **Users** | Search, roles, hard/shadow/lifetime ban, restore, delete (with confirmation); grant or revoke streamer access (web) | ✅ | ✅ | `/admin/users*` |
| **Activity flags** | Accounts flagged for comment or like floods, for review only | ✅ | — | `GET /admin/activity-flags` |
| **Queue** | Per-station queue: search songs, play next, drag to reorder, skip, remove (mobile reorders from the DJ Booth) | ✅ | ✅ | `/admin/radios/:id/queue*` |
| **Fallback & free rotation** | Upload fallback songs, add from the song database, toggle free rotation | ✅ | ✅ | `/admin/fallback-songs*`, `/admin/free-rotation*` |
| **Swipe & feed moderation** | Review and delete Discover clips (play/edit clip windows on web); remove feed media | ✅ | ✅ | `/admin/swipe`, `/admin/feed-media` |
| **Reports** | Reported posts, users, and content; remove or dismiss | ✅ | — | `/admin/reports/*` |
| **Lyrics** | Edit and backfill synced lyrics | ✅ | — | `/admin/lyrics`, `POST /songs/admin/backfill-lyrics` |
| **Payouts** | Pending artist payouts and settlement | ✅ | — | `/admin/payouts/*` |
| **Streamers** | Approve/reject applications, force-stop | ✅ | ✅ | `/admin/streamer-applications` |
| **Platform** | Analytics, live broadcast start/stop, app release broadcast, TestFlight beta invite email | ✅ | ✅ | `/admin/analytics`, `/admin/live/*`, `/admin/app-releases`, `/admin/emails/testflight-beta` |

Admin tools live at `/admin` in the web dashboard, in the separate `admin/` Next.js app, and in the mobile Admin Dashboard (Account & settings → Admin).

---

## 18. Accounts, Auth & Security

| Feature | Description | Web | Mobile | Backend |
|--------|-------------|-----|--------|---------|
| **Firebase Auth** | Email/password, Google, Apple; first-time Google/Apple sign-ins land on profile setup | ✅ | ✅ | Firebase client + Admin |
| **Phone MFA** | Unique mobile number and a text code on every sign-in | ✅ | ✅ | `POST /auth/phone/send|verify`, global `PhoneMfaGuard` |
| **Guest browsing** | Browse radio, artists, and Pro-Networx as a guest; sign in when you act | ✅ | ✅ | `@Public()` routes |
| **Unique names** | Display names and usernames stay unique once taken | ✅ | ✅ | `GET /users/username-available`, migration 149 |
| **Account deletion** | Deleting marks the account for 48 hours; signing in again restores it | ✅ | ✅ | `DELETE /users/me`, `purgeScheduledAccountDeletions` cron |
| **Session cookies (web)** | HTTP-only session cookie for SSR/dashboard | ✅ | — | `web/src/app/api/auth/login|logout` |
| **Bearer token (API)** | `Authorization: Bearer <idToken>` | ✅ | ✅ | Firebase Auth guard |
| **Roles** | listener, artist, service_provider (Catalyst), dj, musician, admin; multiple maker roles per account | ✅ | ✅ | `RolesGuard`, `users.user_roles` |
| **Deep links** | `networxradio://`, Android App Links, iOS Universal Links | — | ✅ | AASA at `web/src/app/.well-known/apple-app-site-association` |

---

## 19. Infrastructure & Observability

| Feature | Description |
|--------|-------------|
| **Hosting** | Web on Vercel (same-origin `/api` rewritten to the backend); NestJS backend on Railway; mobile calls Railway first |
| **Redis** | Radio state shared across servers, listener counts, emoji aggregation, BullMQ push queue |
| **Supabase** | PostgreSQL, Realtime (`station_events`, chat, likes), Storage; RLS on client-exposed tables |
| **Scheduled tasks** | Chat archival, notification and play-log pruning, account deletion purge, broken-audio quarantine, competition and Daily Diamond crons |
| **Structured logging** | Winston JSON logging |
| **Request ID** | Tracing middleware |
| **Sentry** | Error reporting (backend and mobile) |
| **PWA** | Web manifest, service worker, offline fallback (`/~offline`) |

---

## 20. Feature Flags & Config (examples)

- `ARTIST_LIVE_ENABLED` — Artist livestream on/off  
- `STREAM_DONATIONS_ENABLED` — Stream donation flow  
- `STREAM_ADS_TRACKING_ENABLED` — Stream ad impression tracking  
- `BETA_ALL_FREE` — Unlock subscription features during a free test window  
- `THRESHOLD_ENTER_PAID`, `THRESHOLD_EXIT_PAID` — Listener counts that switch a station into and out of paid rotation  
- Trial-by-Fire window: `TRIAL_BY_FIRE_START_UTC`, `TRIAL_BY_FIRE_DURATION_MIN`  
- Cloudflare Stream: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET`  

---

*Last updated: 2026-11-23. See [changelog/](changelog/) for dated release notes.*
