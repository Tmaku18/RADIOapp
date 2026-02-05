---
name: Competition Spotlight and Platform Extensions
overview: Plan extends the competition/spotlight/local-suggestions feature set with admin live broadcast, artist bios, live services promotion, and an artist services marketplace. Service providers are a distinct user type with their own dashboard (still can use radio); they select service types and have bio + portfolio (audio/visual only; no video for now). Artists get a Services tab to search/filter by service type, provider, and location/distance, and to send messages or post requests.
todos: []
isProject: false
---

# Competition, Spotlight, and Platform Extensions (Planned Implementation)

This plan adds to the previously scoped **competition/spotlight/local-suggestions** work three platform extensions: **admin live broadcast** during the stream, **artist bio sections** on artist pages, **live services promotion** (artists promote, listeners connect), and an **artist services marketplace** where artists find providers (content creation, videography, music production, design, etc.) and pay for services. All of this should be reflected in [docs/](docs/) and [README.md](README.md) as planned implementation.

---

## A. Previously Scoped (Summary)

- **On login**: Suggest artists in user's area; user preference "suggest artists in my area".
- **Voting / spotlight**: Top 7 weekly vote (rank 1–7); 7 spotlight days; Artist of Week/Month/Year; prizes.
- **Leaderboard vs saved**: Leaderboard like once per play; saved songs once per user per song.
- **Business model**: Shift to freshman-cypher style (online music popularity competition, community engagement, later live shows/events).

Full detail for A is in the earlier plan (competition, spotlight, local suggestions, data model, APIs, docs/README).

---

## B. New: Admin Live Broadcast During the Stream

**Goal:** In the admin dashboard, admins can go **live** during the radio stream (e.g. host a segment, commentary, or DJ set) so all listeners hear the same live feed over the normal stream.

**Admin dashboard**

- New nav item or section: **Live broadcast** (e.g. under [web/src/app/(dashboard)/admin/](web/src/app/(dashboard)/admin/) or in [adminSubNavigation](web/src/app/(dashboard)/layout.tsx)).
- **Go live** control: Start/stop live broadcast. While live, admin audio (mic or line-in) is mixed or switched into the stream that clients receive.
- Optional: schedule a live slot, or "live now" indicator on the listen page when admin is broadcasting.

**Technical options (to decide)**

- **Option 1 – Stream takeover:** While admin is live, the radio stream URL (or HLS endpoint) switches to a live encoder (e.g. RTMP → HLS, or WebRTC → backend → HLS). Backend or a separate ingest service receives admin audio and outputs HLS; existing radio player continues to use the same "current stream" URL.
- **Option 2 – Overlay / side channel:** Main stream stays as-is; a second "live host" audio stream is available and the client mixes or switches (e.g. "Listen to host" button). More complex in sync and UX.
- **Recommendation:** Plan for Option 1 (stream takeover) with a dedicated live-ingest path and a single stream URL that backend or config switches between "automated radio" and "live broadcast."

**Backend**

- **Live broadcast state:** e.g. `live_broadcast (id, started_at, ended_at, started_by_user_id, status)` or a key in Redis `live_broadcast:active` with ingest URL and expiry.
- **Admin-only endpoints:** e.g. `POST /api/admin/live/start` (body: optional ingest URL or token), `POST /api/admin/live/stop`. These set state so clients or CDN can switch to the live stream URL.
- **Client:** `GET /api/radio/stream-url` or existing current-track endpoint returns `live: true` and live stream URL when admin is live; player uses that URL instead of the automated radio HLS.

**Data model**

- Table or key: `live_broadcast` (or equivalent) to record who went live and when; optional link to `users(id)` for `started_by`.

**Docs / README**

- In [docs/planned-implementation-competition.md](docs/planned-implementation-competition.md) (or single planned-implementation doc): add "Admin live broadcast" — admins can go live during the stream from the admin dashboard; stream switches to live feed; start/stop controls and optional "live now" indicator.
- README "Planned Implementation": one line for admin live broadcast during the stream.

---

## C. New: Artist Pages Include Bio Sections

**Goal:** Every artist has a **bio** (short or long) visible on their artist page so listeners and partners can learn about them.

**Data model**

- **users** (artist profile): add `bio TEXT` (or `bio TEXT, bio_updated_at TIMESTAMPTZ`). Only relevant for `role = 'artist'` (or all users; artists can edit).
- Optional: rich text / markdown; start with plain text, extend later.

**Backend**

- **GET /api/users/:id** (or artist profile endpoint): include `bio` in response.
- **PUT /api/users/me** or **PATCH /api/users/me**: allow artists to set `bio` (and optionally `bio_updated_at`). Enforce role or allow only for artists.

**Frontend**

- **Artist page / profile:** e.g. [web/src/app/(dashboard)/...] artist profile or public artist page: add a **Bio** section that displays `bio`; if empty, show placeholder or hide section.
- **Profile/settings (artist):** Add "Bio" field (textarea or rich editor) and save via existing profile update API.

**Docs / README**

- In planned-implementation doc: "Artist pages include bio sections; artists can set and edit bio from profile/settings."
- README: one line under planned features.

---

## D. New: Artists Promote Live Services; Listeners Connect to Artists

**Goal:** Artists can **promote live services** (e.g. live performances, sessions, events). Listeners can **discover and connect** to artists (e.g. follow, message, or book).

**Data model**

- **Artist “live services”:** e.g. table `artist_live_services` (id, artist_id, title, description, type [e.g. 'performance'|'session'|'meetup'], scheduled_at, link_or_place, created_at, updated_at). Artists create/edit/delete.
- **Connection / follow:** e.g. `artist_follows` (user_id, artist_id) so listeners can "follow" artists; optional `artist_connections` or use follows + optional messaging later.

**Backend**

- **CRUD for artist live services:** `GET/POST/PATCH/DELETE /api/artists/me/live-services` (or `/api/artists/:id/live-services` for public read). List upcoming live services for an artist.
- **Follow artist:** `POST /api/artists/:id/follow`, `DELETE /api/artists/:id/follow`, `GET /api/artists/me/following` (or on user profile).
- **Public:** `GET /api/artists/:id` (or artist profile) returns bio + upcoming live services + optional follow count.

**Frontend**

- **Artist page:** Show bio (C), upcoming "Live services" (events/sessions) and CTA (e.g. "Connect" or "Follow"). Listener can follow and optionally see link to external booking or message.
- **Artist dashboard:** "Promote live services" — create/edit/schedule live services (title, description, type, date, link/place).

**Docs / README**

- Planned-implementation doc: "Artists can promote live services (performances, sessions); listeners can follow artists and see upcoming live services and connect."
- README: one line.

---

## E. New: Artist Services Marketplace (Service Providers as Distinct User Type)

**Goal:** A **marketplace** where **service providers** are a **distinct user type** with their **own dashboard** (they still connect to the radio and can listen). Providers select the **type(s) of service** they offer; have a **bio** and **portfolio** (audio and visual only; no video for now). **Artists** get a dedicated **Services** tab to search/filter by service type, provider (user), and **location/relative distance**, and to **send messages** or **post requests** to providers.

**Service provider as a user type**

- **Role:** Add `service_provider` (e.g. extend `users.role` CHECK to include `'service_provider'`). Same auth (Firebase); distinct from listener/artist/admin.
- **Dashboard:** Provider-specific dashboard (web + optional mobile): profile (bio), portfolio management, service type(s), listings, orders, and **inbox** for messages and requests. Radio remains available (Listen) so providers can use the app like any user.
- **Service types (provider selects):** e.g. content creation, videography, music production, design (album art, logos, branding), marketing/PR — extensible. Stored per provider so artists can **search and filter by service type**.

**Search and filter (artists)**

- **By service type:** Filter providers/listings by one or more service categories.
- **By provider (user):** Search or browse by provider name/user.
- **By location / relative distance:** Store provider **location** (e.g. region, city, or lat/lng). Artists have location (from profile/competition work). **Search/filter by distance** (e.g. "near me" or within X km/miles). Requires location on both sides and distance calculation or region match.

**Artists: Services tab**

- **Dedicated tab** in the artist experience (e.g. sidebar "Services" next to Listen, My Songs, etc.).
- **Interact:** Browse providers, view provider profile (bio + portfolio), listings, and **send messages** to providers (in-app messaging).
- **Post requests:** Artists can **post requests** (e.g. "I need a music video," "Looking for album art") that providers can see and respond to (e.g. in a "Requests" feed or in provider dashboard). Thread or conversation per request.
- **Flow:** Search/filter → view provider → message or post request → (later) book and pay.

**Providers: bio and portfolio**

- **Bio:** Providers have a **bio section** (same idea as artist bio): `bio TEXT` on user or provider profile. Editable from provider dashboard.
- **Portfolio:** Providers can **upload a portfolio of work** for artists to see. Each item is **audio or visual only** (images, audio files). **No video for now** (maybe later). Stored in storage (e.g. Supabase Storage) with metadata (title, description, type: image | audio).
- **Data model:** e.g. `provider_portfolio_items` (id, user_id [provider], type ['image'|'audio'], file_url, title, description, sort_order, created_at). No `video` type initially.

**Data model (summary)**

- **users:** Extend `role` to include `'service_provider'`; providers have `bio` (or reuse same `bio` column for artists and providers). Location fields for provider (and artist) for distance: e.g. `region`, or `lat/lng`, or `city/country`.
- **Provider profile / service types:** e.g. `service_providers` (id, user_id UNIQUE, bio, location_region, lat, lng, created_at, updated_at) and `service_provider_types` (provider_id, service_type) so one provider can offer multiple types. Or `service_listings` (id, provider_id, service_type, title, description, rate_cents, rate_type, status, ...) with service_type per listing.
- **Listings:** `service_listings` (id, provider_id, service_type, title, description, rate_cents, rate_type, status, created_at). Artists filter by service_type and by provider location.
- **Portfolio:** `provider_portfolio_items` (id, user_id, type ['image'|'audio'], file_url, title, description, sort_order, created_at). No video type for now.
- **Messages:** `service_messages` (id, sender_id, recipient_id, thread_id or request_id, body, created_at) for artist–provider messaging.
- **Requests (artist-posted):** `service_requests` (id, artist_id, title, description, service_type, status, created_at). Providers can view open requests and reply (e.g. create a message or a proposal linked to the request).
- **Orders:** `service_orders` (id, artist_id, provider_id, listing_id or request_id, status, amount_cents, stripe_payment_intent_id, created_at, updated_at).

**Backend**

- **Provider dashboard APIs:** Profile (bio, location), portfolio CRUD (upload image/audio; list; no video). Listings CRUD. Orders list. Inbox: messages and incoming requests.
- **Artist Services tab APIs:** `GET /api/services/providers?serviceType=...&nearLat=...&nearLng=...&radiusKm=...` (search/filter by type and location/distance). `GET /api/services/providers/:id` (profile + bio + portfolio items). `POST /api/services/messages` (send message). `POST /api/services/requests` (post request). `GET /api/services/requests` (artist’s requests; provider’s view of open requests). Thread/conversation endpoints for messages linked to a request or provider.
- **Location/distance:** Store provider location (region or lat/lng). If lat/lng, use distance calculation (e.g. PostGIS or formula) for "near me" and radius filter.

**Frontend**

- **Provider dashboard (web):** Own layout/sidebar for role `service_provider`: Profile (bio, location), Portfolio (upload/list image and audio only), Service types and listings, Orders, Inbox (messages + requests). Listen (radio) still in nav.
- **Artist: Services tab:** Search/filter (service type, location/distance, provider name). List of providers; provider detail page (bio, portfolio, listings). "Message" and "Post request" actions. Requests feed (my requests; responses from providers). Later: book and pay flow.
- **Portfolio display:** Provider profile shows portfolio items (images and audio); no video playback for now.

**Payments**

- Unchanged: Stripe for artist→platform or artist→provider; payouts to providers (Connect or manual). Escrow/release later phase.

**Docs / README**

- Planned-implementation doc: "Service providers are a distinct user type with their own dashboard (radio still available). Providers select service types and have bio + portfolio (audio and visual only; no video for now). Artists have a Services tab: search/filter by service type, provider, and location/distance; send messages and post requests; view provider bio and portfolio."
- README: one line for marketplace, provider role, Services tab, and portfolio (audio/visual; video later).

---

## F. Implementation Order (Suggested)

1. **Docs and README** — Add/update [docs/planned-implementation-competition.md](docs/planned-implementation-competition.md) (or single planned-implementation doc) to include all of A–E; add README "Planned Implementation" section with bullets for competition/spotlight, admin live broadcast, artist bios, live services + listener connection, and artist services marketplace.
2. **Artist bio (C)** — Schema + API + artist profile/settings UI (small, self-contained).
3. **Admin live broadcast (B)** — State, admin endpoints, stream URL contract, then admin UI and client stream switching.
4. **Live services + connection (D)** — Tables, CRUD APIs, artist page "live services" and "follow" UI.
5. **Competition/spotlight (A)** — As in original plan (data model, APIs, jobs, web/mobile).
6. **Services marketplace (E)** — Add `service_provider` role and provider dashboard (bio, location, portfolio audio/visual only, service types, listings, orders, inbox). Artist Services tab (search/filter by service type, provider, location/distance; messages; post requests). Messages and requests schema; Stripe when booking/pay is implemented.

---

## G. Open Decisions

- **Admin live broadcast:** Exact ingest (RTMP vs WebRTC vs other) and where encoding runs (backend vs separate service).
- **Bio:** Plain text first vs rich text/markdown from day one.
- **Live services:** Whether "connect" includes in-app messaging or only follow + external link.
- **Marketplace:** Stripe Connect (pay provider directly) vs platform-held payments then payout; escrow and dispute flow.
- **Service provider role:** Single role `service_provider` vs hybrid (e.g. user can be both artist and provider); plan assumes distinct role with own dashboard.
- **Location/distance:** Region/city only vs lat/lng with radius (e.g. PostGIS or haversine); affects search/filter implementation.
- **Portfolio:** Video support deferred; add `video` type later when needed.

---

Once you confirm this plan, the next step is to add these items to the planned-implementation doc and README (and, when implementing, to the admin dashboard nav and artist pages as described).
