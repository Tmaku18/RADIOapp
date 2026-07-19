---
name: ""
overview: ""
todos: []
isProject: false
---

# Industry Catalyst, Engine Pages & Advanced MVP

**Principle:** Build the logic; Mehek provides the "skin" (visual design, copy, marketing assets).

This plan merges:

- **Design Requirements v2.0:** Catalyst profile UI, Mentor badge, directory filters, 4 AM narrative, marketing.
- **Essential "Engine" pages:** 4 AM Hero + Live Ripple, The Stage (player + ad slot + presence), Pro-Directory (PostGIS), ROI Artist Dashboard.
- **Advanced infrastructure:** Trial by Fire leaderboard, Credits wallet (Quick-Buy), Catalyst portfolio deep-link.
- **Suggestions:** PWA, PostGIS, AI tagging, Referral, Global State Visualizer; skip Blockchain/VR.

---

## Part A — Industry Catalyst (from v2.0)

### A.1 Catalyst Profile UI

- **Hero:** Large hero image (best work) + location tag. Store `hero_image_url` on `service_providers`; fallback to first portfolio image.
- **Portfolio gallery:** Grid; support `video` type in `provider_portfolio_items` for reels/thumbnails.
- **Service menu:** Clean table (service name, description, price). Refine existing Menu card into table layout.
- **DM CTA:** Primary "Message" / "Get in touch" → `/messages?with={userId}`.
- **Social bridge:** Add `instagram_url`, `linkedin_url`, `portfolio_url` to `service_providers`; show on profile + edit form.

### A.2 Mentor Badge

- **DB:** `service_providers.mentor_opt_in` (boolean).
- **Edit profile:** Toggle in artist/services for Catalysts. Backend profile + discovery APIs return flag.
- **Visual:** Mehek-designed custom SVG glow on card + profile (butterfly wing or "M" frequency bar). Logic: show when `mentor_opt_in === true`.

### A.3 Pro-Directory Search & Filters

- **PostGIS (mandatory):** Replace/adjust `service_providers.lat/lng` with PostGIS `geography(POINT)` for proper geo search. Discovery API: sort by distance, filter by radius.
- **Filters:** Service category (Photo, Video, Production, Marketing + existing types), **price_range** (min/max rate_cents), **Nearby** toggle (user location → geo query).
- **Directory pages:** Discover + artist/services; same filters + Mentor badge on cards.

### A.4 Catalyst Landing & 4 AM Narrative

- Dedicated route (e.g. `/pro-directory` or `/catalysts`) with 4 AM story + Catalyst role + CTAs. Obsidian Night + Butterfly Electric. Link from marketing nav and dashboard.

### A.5 Marketing: "Catalyst Call" Ad

- Copy for Mehek: headline, sub-headline, palette note (Obsidian Night, Butterfly Electric). No code; asset deliverable.

---

## Part B — Essential "Engine" Pages (MVP)

### B.1 The "4 AM" Hero Landing (Marketing Home)

**Vibe:** High-conversion, story-driven. Mehek: skin.

**Tech features (logic):**

1. **Live Ripple visualizer**
  - Canvas or Three.js element that creates a **ripple effect whenever someone somewhere in the world votes on a track**.
  - Implementation: Subscribe to vote/like events (Supabase Realtime or backend WebSocket/polling). On each event, trigger a ripple animation (e.g. expand from center or from a random point). No need to show who voted; just "platform is alive."
  - Data source: Existing likes/votes (e.g. `spotlight` votes or song likes). Backend or Supabase channel that broadcasts "vote" events (anonymous count or single pulse).
2. **Dynamic CTA routing by user type**
  - If user is **Artist** → CTA goes to artist dashboard / upload / credits.
  - If **Catalyst** (service_provider) → CTA to Pro-Directory / My Services.
  - If **Listener** (or not logged in) → CTA to "Listen now" / signup / competition.
  - Implementation: On marketing home, if `user` is present, read `profile.role` and render primary CTA accordingly; otherwise show "Get Started" / "Listen" / "Join as Catalyst."

**Files:** [web/src/app/(marketing)/page.tsx](web/src/app/(marketing)/page.tsx) (hero section + CTA logic). New component: `LiveRippleVisualizer` (canvas/Three.js + subscription to vote events).

---

### B.2 The "Stage" (24/7 Web Player)

**UI:** Clean "Now Playing" interface. Mehek: skin.

**Tech features:**

1. **Visual Ad Slot (Venue Partners)**
  - Dedicated component **above the chat** for Venue Partners.
  - **Supabase Realtime subscription** to rotate creatives based on the **current station's schedule**.
  - Schema: e.g. `venue_ad_slots` (id, station_id or global, image_url, link_url, start_at, end_at, sort_order) or a simple `venue_ads` table with schedule. Realtime: channel that sends "current ad" payload when schedule changes or on interval.
  - Component: Fetch or subscribe to current ad(s); display image/banner; click-through to link.
2. **Live Sync Chat**
  - Already present; ensure **high-concurrency** (message throttling, pagination, optimistic updates). Backend: [backend/src/chat](backend/src/chat).
3. **"Artists in the Room" (Supabase Presence)**
  - Use **Supabase Presence** on the listen/radio channel to show which users in the room are **artists** (or have their track playing).
  - Logic: On join, set presence with `role` and optional `artistId` / `currentTrackArtistId`. UI: "Artists in the Room" list or badge (e.g. "3 artists listening"). Drives authentic connection.

**Files:** [web/src/app/(dashboard)/listen/page.tsx](web/src/app/(dashboard)/listen/page.tsx), [web/src/components/radio/RadioPlayer.tsx](web/src/components/radio/RadioPlayer.tsx). New: `VenueAdSlot` (subscription + display), presence integration in listen page or chat component.

---

### B.3 Catalyst Pro-Directory (LinkedIn for Music)

**Logic (already in A.3, restated):**

- **Advanced filtering:** PostGIS geo, `price_range` (min/max rate_cents), **specialty** (service type/category).
- **Mentor Badge:** Boolean in profiles table → custom SVG glow on card (Mehek design).

**PostGIS (mandatory):**

- Migration: Add PostGIS extension; add `geography(POINT)` column to `service_providers` (e.g. `location_geo`). Backfill from `lat`/`lng` if present.
- Discovery API: Accept `lat`, `lng`, `radius_km`. Query: `ST_DWithin(location_geo, ST_MakePoint(lng, lat)::geography, radius_km * 1000)` and order by `ST_Distance`.

---

### B.4 The "ROI" Artist Dashboard

**Data / logic:**

1. **Real-time ROI**
  - Formula: \text{ROI} = \left( \frac{\text{New Followers}}{\text{Credits Spent}} \right) \times 100
  - **New Followers:** Delta in follower count over a chosen window (e.g. last 7 days, or since last period). Data: `artist_follows` + created_at.
  - **Credits Spent:** From `credits` or payment/transaction history (credits consumed in same window).
  - Backend: Analytics or new endpoint that returns `{ newFollowers, creditsSpent, roi }` for the artist. Frontend: Display on artist dashboard (e.g. [web/src/app/(dashboard)/artist/stats/page.tsx](web/src/app/(dashboard)/artist/stats/page.tsx) or dedicated ROI card).
2. **Heatmap: where listeners are tuning in from during their 1-minute rotation**
  - During the 1-minute (or current) rotation of an artist's track, show a **heatmap** of listener locations.
  - Data: Need **listener location** at play time. Options: (a) Store region/country (or lat/lng if consented) when user is on listen page and a play is logged; (b) Use existing analytics (e.g. `plays` or `radio_play` events) and attach region if available (e.g. from IP or profile).
  - Implementation: Table or analytics event that includes `play_id`, `artist_id`, `listener_region` or `lat/lng`. Backend endpoint: for current or last play of artist, return list of regions/counts or geo points. Frontend: Heatmap component (e.g. map library or simple region-count list). If no geo yet, scaffold with "region" from profile or IP and add heatmap UI placeholder.

**Files:** Analytics service, artist stats/dashboard page, new ROI card and heatmap component.

---

## Part C — Advanced Infrastructure

### C.1 "Trial by Fire" Leaderboard

**Function:** Algorithmic ranking of tracks based on **upvotes per minute** (or per play window).

- Metric: e.g. `(upvotes in last N minutes) / (number of plays in same window)` or similar. Backend: Aggregate likes/votes and plays by song and time; compute rate; return ranked list.
- **Rising Star notification:** When an artist hits a **5% conversion rate** (e.g. 5% of plays result in a like/upvote in that window), trigger a **"Butterfly Ripple" alert** to **all listeners on that station**.
  - Implementation: After each vote or on a periodic job, compute conversion rate for current/recent track; if >= 5%, broadcast via Supabase Realtime or push to all clients on listen page: "Rising Star: [Artist] just hit 5% conversion!" with optional ripple animation.

**Files:** Leaderboard service (extend [backend/src/leaderboard](backend/src/leaderboard)), Realtime channel or push for Rising Star.

---

### C.2 Credits Wallet ($1/min) & Quick-Buy

**Integration:** Stripe Treasury or Stripe Connect (for artist payouts / wallet). Current system uses credits and Stripe Checkout; extend as needed for "wallet" UX.

**Quick-Buy for artists:**

- While listening to **their own track**, artist can **"Add 5 Minutes"** with a **one-tap Apple Pay / Google Pay** button (e.g. when chat is "vibing").
- Logic: On listen page, if current track's `artist_id === profile.id`, show a prominent "Add 5 Minutes" (or N minutes) button. Button triggers Stripe Payment Element or Express Checkout (Apple/Google Pay). On success, add credits and optionally extend rotation. Backend: Reuse existing credits purchase flow; optional: dedicated "quick add minutes" endpoint that creates a minimal checkout for fixed amount.

**Files:** [backend/src/payments](backend/src/payments), [web listen page + payment components]. Stripe docs for Payment Request Button (Apple/Google Pay).

---

### C.3 Catalyst Portfolio "Deep-Link"

**Function:** Allow Catalysts to **link specific works to tracks** already on the radio. If a photographer shot the cover art for a song in rotation, their profile is **"Pinned" during that song's airtime**.

**Data model:**

- **Track–Catalyst link:** e.g. `song_catalyst_credits` (song_id, user_id [catalyst], role: 'cover_art' | 'video' | 'production' | etc.). One song can have multiple catalysts (photographer, producer, etc.).
- **Runtime:** When radio returns `current` track, also return `pinned_catalyst_ids` (or full profile summary) for that song. Listen page or Stage UI: show "Cover art by [Catalyst]" with link to Catalyst profile; optional "Pinned" badge.

**Implementation:**

- Backend: Table + API to attach/detach catalysts to songs (artist or admin only for their songs). Radio `current` or separate endpoint returns current track + linked catalysts.
- Frontend: During that song's airtime, show pinned Catalyst card/link above or below Now Playing.

**Files:** New migration, radio or songs service, listen page component.

---

## Part D — Suggestions: Necessary vs Over-Engineered


| Feature                      | Necessity       | Notes                                                                                                                                                                      |
| ---------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PWA**                      | **Mandatory**   | Web-first radio; installable on home screen is vital for listener retention. Add web manifest + service worker (Next.js PWA or similar).                                   |
| **PostGIS location search**  | **Mandatory**   | Pro-Directory: artists find e.g. "photographer in Atlanta." Part A.3 / B.3.                                                                                                |
| **AI track tagging**         | **Improvement** | BPM and Mood auto-tag during upload (for stations/organization). Python microservice or Next.js Edge function; call after upload, write tags to `songs` or metadata table. |
| **Blockchain / NFTs / Web3** | **Unnecessary** | Adds friction. Focus on $1/min and credits first.                                                                                                                          |
| **VR Radio Room**            | **Unnecessary** | Cool for later; now focus on 300 listeners on web + mobile and Live Sync Chat.                                                                                             |


---

## Part E — Execution Strategy (Cursor Pro)

### E.1 Database schema

- Use Cursor to generate Supabase migrations for:
  - 3-sided marketplace: **profiles** (artists/catalysts), **tracks** (audio_url, credit_balance, etc.), **engagements** (votes, chat logs).
  - Catalyst-specific: hero, social links, mentor_opt_in, PostGIS geography.
  - Venue ads, song_catalyst_credits, and any new analytics for ROI/heatmap.

### E.2 Audio streaming

- **HLS (HTTP Live Streaming)** for the radio to prevent buffering (instead of raw .mp3).
- Cursor can help with: Mux integration, or self-hosted FFmpeg worker in Docker outputting HLS. Radio service then serves HLS URL as `stream_url`.

### E.3 Referral logic

- **Prompt:** "Write a Next.js middleware that checks for a `ref` query parameter, stores it in a cookie, and associates it with the user's profile on sign-up in Supabase."
- Tables: e.g. `referrals` (referrer_id, referred_id, created_at) or `profiles.referred_by_user_id`. On signup, read cookie and create referral row.

### E.4 The "Butterfly" Touch — Global State Visualizer

- **Homepage:** Small **glowing map** that shows a **"ping"** every time a listener **upvotes** a song. Proves the platform is alive.
- Implementation: Map (e.g. simple world or region map via SVG or library). Subscribe to global vote events (Supabase Realtime or polling); on each vote, show a ping (e.g. at random or at listener’s region). Anonymous; no PII. Can share backend with Live Ripple (vote event stream).

---

## Implementation order (recommended)

1. **Migrations:** PostGIS + service_providers (hero, social, mentor_opt_in, geography); venue_ads; song_catalyst_credits; referral/referred_by if doing referrals.
2. **4 AM Hero:** Live Ripple (vote subscription + canvas/Three.js), dynamic CTA by role.
3. **Stage:** Venue Ad Slot (Realtime + schedule), Artists in the Room (presence).
4. **Pro-Directory:** PostGIS discovery, price_range, specialty, Mentor Badge SVG on cards and profile.
5. **Catalyst profile:** Hero, service menu table, portfolio (incl. video), social links, DM CTA; Catalyst landing page.
6. **ROI Dashboard:** ROI formula + new followers/credits spent; heatmap (scaffold with region data).
7. **Leaderboard:** Upvotes-per-minute ranking; Rising Star 5% alert.
8. **Credits Quick-Buy:** Add 5 Minutes with Apple/Google Pay when artist is listening to own track.
9. **Catalyst Deep-Link:** song_catalyst_credits + pinned profile during airtime.
10. **PWA:** Manifest + service worker.
11. **Referral:** Middleware + cookie + sign-up association.
12. **Global State Visualizer:** Map + ping on upvote (homepage).
13. **AI tagging:** Optional; BPM/Mood microservice or Edge function post-upload.

---

## Mehek handoff (skin / assets)

- 4 AM Hero: story-driven layout, visuals (Mehek).
- Stage: Now Playing and ad slot layout (Mehek).
- Mentor Badge: custom SVG glow (butterfly wing or "M" frequency bar).
- Catalyst Call ad: headline, sub-headline, Obsidian Night + Butterfly Electric for Instagram Stories.
- ROI and heatmap: chart/heatmap styling (Mehek).
- Global map visualizer: style of map and ping (Mehek).

