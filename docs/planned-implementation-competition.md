# Planned Implementation: Competition, Spotlight, and Platform Extensions

**Status:** In implementation (planned features being built).

This document summarizes the planned **competition/spotlight** experience and **platform extensions** (admin live broadcast, artist bios, live services, service provider marketplace). Full detail is in the plan files under `.cursor/plans/`.

---

## Business Model Shift

The platform is shifting from competing with Spotify to an **online music popularity competition** (freshman-cypher style): community artist engagement, voting and spotlight, leaderboards, and later **live shows and events**. Revenue and growth are tied to competition, prizes, and artist services, not only to credit-based airplay.

---

## Competition & Spotlight (First Page After Login)

- **First screen on login:** Competition/spotlight page showing:
  - **Leaderboards** — by **likes** (one like per radio play) and by **listens** (spotlight/artist-of-week/month replays).
  - **Featured artists** — today’s spotlight and this week’s lineup; click through to artist pages.
  - **Voting** — “Vote for Top 7” (rank 1–7) on the same screen; voting week = Monday–Sunday (ISO).
  - **News and promotions** — dynamic ticker/cards/carousel (data from Supabase).
  - **Dynamic UI** — marquees, motion, staggered reveals, live-updating leaderboard; modern, futuristic, sleek (shadcn, Supabase, Firebase).
- **Unlimited listening:**
  - **Featured song** — on a featured artist’s page, unlimited replays of their featured song; each play counted for listens leaderboard.
  - **Artist of the Week** — on their page, all their music unlimited for that week; plays counted.
  - **Artist of the Month** — on their page, all their music unlimited for the next month; plays counted.
- **Location:** “Artists in your area” suggestion (country + optional region/city); user preference toggle to enable/disable.
- **Week → Month → Year:** Weekly top 7 → Artist of the Week → end-of-month vote → Artist of the Month → end-of-year vote → Artist of the Year and prize.

---

## Platform Extensions

- **Artist bios:** Artist (and service provider) profile pages include a **bio** section; editable from profile/settings.
- **Admin live broadcast:** Admins can go **live** during the stream from the admin dashboard; stream URL switches to live feed; start/stop controls and “live now” indicator.
- **Live services:** Artists can **promote live services** (performances, sessions); listeners can **follow** artists and see upcoming live services and connect.
- **Service provider (distinct user type):**
  - New role `service_provider` with **own dashboard** (radio still available).
  - Providers select **service types** (content creation, videography, music production, design, etc.); have **bio** and **portfolio** (audio and visual only; no video for now).
  - **Artists** get a **Services** tab: search/filter by service type, provider, and location/distance; **send messages** and **post requests**; view provider bio and portfolio.
  - Marketplace: listings, requests, orders; payments via Stripe (later).

---

## Data Model Summary

- **Users:** `region` (country + optional region/city), `suggest_local_artists`, `bio`; role includes `service_provider`.
- **Competition:** `leaderboard_likes`, `weekly_votes`, `artist_spotlight` (date, artist_id, song_id), `weekly_winners`, `monthly_winners`, `yearly_winners`; `spotlight_listens`, `songs.spotlight_listen_count`; `news_promotions`.
- **Extensions:** `artist_live_services`, `artist_follows`; `live_broadcast`; `service_providers`, `service_listings`, `provider_portfolio_items`, `service_messages`, `service_requests`, `service_orders`.

---

## API Summary

- **Users:** `PATCH/GET /api/users/me` — region, suggest_local_artists, bio.
- **Suggestions:** `GET /api/suggestions/local-artists`.
- **Leaderboard:** `GET /api/leaderboard/songs?by=likes|listens`; `POST /api/songs/:id/leaderboard-like`.
- **Spotlight listens:** `POST /api/spotlight/listen`, `GET /api/spotlight/can-listen-unlimited`.
- **Competition:** `GET /api/competition/current-week`, `POST /api/competition/vote`, `GET /api/competition/weekly-results`; `GET /api/spotlight/today`, `GET /api/spotlight/week`; monthly/yearly winners and votes.
- **Feed:** `GET /api/feed/news-promotions`.
- **Admin:** `POST /api/admin/live/start`, `POST /api/admin/live/stop`; `GET /api/radio/stream-url` returns live state.
- **Artists:** Live services CRUD; follow artist; artist profile with bio and live services.
- **Services (marketplace):** Provider profile, portfolio, listings; artist Services tab: search providers, messages, post requests; orders (later).

---

## UI Flows

- **Post-login:** Redirect to competition/spotlight page (first screen).
- **Competition page:** Leaderboards (likes + listens), featured artists, voting, news/promotions; dynamic, moving elements.
- **Artist page:** Bio, featured song (unlimited replays), or Artist of Week/Month unlimited catalog; live services and follow.
- **Profile/settings:** Region, “Suggest artists in my area,” bio (artist/provider).
- **Admin:** Live broadcast start/stop; optional news/promotions management.
- **Artist dashboard:** Promote live services.
- **Provider dashboard:** Bio, portfolio (audio/visual), service types, listings, inbox.
- **Artist Services tab:** Browse providers, filter by type/location, message, post requests.

---

## Implementation Status

- **Step 1:** Docs and README — done (this doc and README section).
- **Steps 2–11:** Data model, APIs, scheduled jobs, Web UI, Mobile UI — in progress.
- **Platform extensions:** Data model and APIs integrated; Web UI for admin live, artist bio, live services, provider dashboard, Services tab — in progress.

See `.cursor/plans/competition_and_spotlight_features_9428ea2f.plan.md` and `.cursor/plans/competition_spotlight_and_platform_extensions_504f7fde.plan.md` for full detail.
