---
name: Competition and Spotlight Features
overview: Plan to add competition/spotlight as the first page after login (leaderboards, featured artists, voting, news and promotions), unlimited listening for featured/Artist of Week/Month, listen counting and listens leaderboard, and a modern futuristic UI with dynamic shifting and changing elements using shadcn, Supabase, and Firebase (MCP as needed), plus docs and README.
todos: []
isProject: false
---

# Competition, Spotlight, and Local Artist Suggestions (Planned Implementation)

This plan adds an **online music popularity competition** layer (freshman-cypher style) on top of the existing radio platform: location-based artist suggestions on login, weekly Top 7 voting and daily artist spotlight, leaderboard vs saved-songs behavior, and a Week → Month → Year competition with prizes. It also records the business-model shift and documents everything in [docs/](docs/) and [README.md](README.md) as planned implementation.

---

## 1. Scope Summary


| Area                    | What’s added                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **First page on login** | **Competition / spotlight** is the **first screen** users see after login. It shows **leaderboards** (by likes and by listens), **featured artists**, **voting**, and **news and promotions** on the same screen, with **dynamic shifting, moving, and changing elements** for a **modern, futuristic, sleek** feel. Built with **shadcn**, **Supabase**, and **Firebase** (use MCP as needed). Clicking into an artist’s page allows **unlimited replays** of their **featured song**. |
| **On login (optional)** | Suggest artists in the user’s area (“Have you heard this new artist in your area?”) with a **user preference** to enable/disable “suggest artists in my area”; can be a block on the competition landing or after.                                                                                                                                                                                                                                                                      |
| **Voting / spotlight**  | End-of-week vote: users pick **top 7 songs** and **rank them 1–7**. Those 7 artists get **one spotlight day each** (artist spotlight = one featured artist per day). **Users and artists** both vote for Artist of the Week. Voting is available **on the competition/spotlight screen**.                                                                                                                                                                                               |
| **Leaderboards**        | **Two leaderboards:** (1) **By likes** — user can like a song **once per play** on the radio for leaderboard; **saved songs** are separate (one per user per song). (2) **By listens** — songs ranked by **listen count** (replays on artist pages, artist-of-week/month unlimited listens; all counted).                                                                                                                                                                               |
| **Unlimited listening** | **Featured song:** On a featured artist’s page, users can listen to that artist’s **featured song** as many times as they want (unlimited replays). **Artist of the Week:** On their page, **all their music** is **unlimited for that week**. **Artist of the Month:** On their page, **all their music** is **unlimited for the next month**. All such listens are **counted** and feed the **listens leaderboard**.                                                                  |
| **Prizes**              | Top-ranked featured artist from the week is eligible for **cash/prize**. Weekly winners are voted on at **end of month** → **Artist of the Month**. All **monthly winners** are voted on for the **year** → annual prize.                                                                                                                                                                                                                                                               |
| **News and promotions** | The competition/spotlight page **displays news and promotions** (e.g. platform updates, events, offers). Content is dynamic and can be managed via admin or Supabase.                                                                                                                                                                                                                                                                                                                   |
| **UI / visual design**  | **Dynamic, shifting, moving, and changing elements** (e.g. marquees, subtle motion, staggered reveals, live-updating leaderboard). **Modern, functional, futuristic, sleek.** Use **shadcn** components; **Supabase** for data; **Firebase** for auth; consult **shadcn**, **Supabase**, and **Firebase MCP** when implementing.                                                                                                                                                        |
| **Positioning**         | Shift from “compete with Spotify” to “compete with companies that do the freshman cypher”: online music popularity competition, community artist engagement, and later **live shows/events**.                                                                                                                                                                                                                                                                                           |


---

## 2. Current State (Relevant Parts)

- **Users**: [docs/database-schema.md](docs/database-schema.md) — no location or “suggest local artists” preference.
- **Songs/artists**: No artist/region or song region; no concept of “featured” or “spotlight”.
- **Likes**: [backend/src/songs/songs.service.ts](backend/src/songs/songs.service.ts) — single toggle per (user, song) in `likes`; [docs/database-schema.md](docs/database-schema.md) `likes` table and `songs.like_count`.
- **No voting/ranking**: No tables or APIs for “top 7”, “rank 1–7”, or “artist of the week/month/year”.
- **No leaderboard**: No API that returns songs ordered by like count for a leaderboard; like model is one-like-per-user-per-song (no “once per play” for leaderboard).
- **README**: [README.md](README.md) — purpose, features, and “Temporarily Disabled Features”; no “Planned Implementation” section yet.

---

## 3. Data Model (New/Changed)

**Users**

- `region` or `location` (e.g. country + optional region/city or lat/lng) for “artists in your area”.
- `suggest_local_artists BOOLEAN DEFAULT true` to respect “suggest artists in my area” on/off.

**Artists / songs (for “in area”)**

- Option A: Add `region` (or `country`, `region`, `city`) to `users` (artist profile) so “artists in your area” = artists whose region matches/list is near user’s region.
- Option B: Add optional `region` (or tags) to `songs` and derive artist “area” from their songs. Prefer **Option A** (artist-level region) for simplicity.

**Leaderboard likes vs saved songs**

- **Leaderboard**: Allow one like per user **per play** of a song. So either:
  - New table `leaderboard_likes (id, user_id, song_id, play_id, created_at)` with `play_id` referencing `plays.id`, and optionally unique `(user_id, play_id)` so one like per user per play; or
  - `leaderboard_likes (user_id, song_id, played_at_date_or_play_window)` to allow one like per user per “play window” (e.g. per calendar day or per play event).
- **Saved songs**: Keep current `likes` as “saved” (one per user per song) or rename/clarify; or add `saved_songs (user_id, song_id)` and keep `likes` only for legacy/leaderboard. Clear product decision: either `likes` = saved and leaderboard = new table, or `likes` = leaderboard (per-play) and `saved_songs` = new. Plan assumes: **new `leaderboard_likes**` (per play), **existing `likes**` repurposed as **saved songs** (one per user per song). If you prefer the opposite, swap names in implementation.

**Voting and spotlight**

- **Weekly top 7 / ranking**: e.g. `weekly_votes (id, user_id, period_start_date, song_id, rank_1_to_7, created_at)` with unique `(user_id, period_start_date, rank)` so each user submits one ordered set of 7 per week. Or `weekly_vote_entries (user_id, period_start_date, song_id, rank)`.
- **Artist of the week (winner)**: Either derived from weekly_votes (e.g. song/artist with best aggregate rank) or a separate `artist_spotlight (date, artist_id, source: 'weekly_winner' | 'manual')`. Store **weekly winners** (e.g. `weekly_winners (period_start_date, artist_id, song_id, rank_1_artist_id)` or similar) so month/year can roll up.
- **Artist of the month**: `monthly_winners (year, month, artist_id)` from end-of-month vote among that month’s weekly winners.
- **Artist of the year**: `yearly_winners (year, artist_id)` from vote among monthly winners; ties to **prize** (cash/other).

**Spotlight calendar**

- Table or view: **one artist per calendar day** (e.g. `artist_spotlight (date DATE PK, artist_id, song_id?, source)`). Filled by: weekly top-7 (each of 7 gets a day), then repeat or fill with runner-up/manual. The **featured song** for that day is `song_id` (the song that won or is promoted for that artist).

**Listen counting and listens leaderboard**

- **Count all listens** that contribute to the “listens” leaderboard: (1) **Featured song replays** — when a user plays the featured song on a featured artist’s page (unlimited replays), each play is recorded. (2) **Artist of the Week** — when a user plays any song by the current artist of the week on that artist’s page during their week, each play is recorded. (3) **Artist of the Month** — when a user plays any song by the current artist of the month on that artist’s page during their month, each play is recorded.
- **Storage:** e.g. `spotlight_listens` (id, user_id, song_id, artist_id, source ['featured_replay'|'artist_of_week'|'artist_of_month'], created_at) for analytics and fairness; and/or increment a **denormalized** `spotlight_listen_count` (or reuse/extend `play_count`) on `songs` so the listens leaderboard can sort by total listens. If radio plays also count toward the same leaderboard, use one count; if the “listens leaderboard” is **only** spotlight/featured/artist-of-week/month listens, use a separate column e.g. `spotlight_listen_count` so it stays a **separate leaderboard** from likes.
- **Separate leaderboard by listens:** Songs (or artists) ranked by this listen count. API returns a **listens leaderboard** distinct from the **likes leaderboard**.

**News and promotions**

- Table e.g. `news_promotions` (id, type ['news'|'promotion'], title, body_or_description TEXT, image_url, link_url, starts_at, ends_at, sort_order, is_active BOOLEAN DEFAULT true, created_at, updated_at). Stored in **Supabase**; optional admin UI or direct Supabase edits. Display on competition/spotlight page; can use **Supabase Realtime** for live updates if desired.

**Indexes**

- User: `(region)`, `(suggest_local_artists)` if querying by region.
- News/promotions: `(is_active, starts_at, ends_at)`, `(sort_order)`.
- Leaderboard: `leaderboard_likes (song_id, created_at)` and possibly `(user_id, song_id, play_id)` for uniqueness/rate limiting.
- Listens: `spotlight_listens (song_id, created_at)`, `spotlight_listens (artist_id, source)`; index on `songs.spotlight_listen_count` (or equivalent) for listens leaderboard.
- Votes: `(period_start_date, user_id)`, `(period_start_date, song_id)` for aggregation.

---

## 4. Backend (APIs and Services)

- **Users**
  - `PATCH /api/users/me`: extend body with `region?`, `suggestLocalArtists?`.
  - `GET /api/users/me`: return `region`, `suggestLocalArtists`.
- **Suggestions on login**
  - `GET /api/suggestions/local-artists` (or `/api/feed/local-artists`): returns artists (or songs) “in user’s area” when `suggestLocalArtists` is true; uses `users.region` and artist `region`; optional limit (e.g. 5–10). Called after login by web/mobile to show “Have you heard … in your area?”.
- **Leaderboard**
  - `GET /api/leaderboard/songs?limit=50&offset=0&by=likes`: songs ordered by **leaderboard like count** (from `leaderboard_likes` or new aggregate), with pagination.
  - `GET /api/leaderboard/songs?by=listens&limit=50&offset=0`: **separate leaderboard** — songs ordered by **listen count** (spotlight_listen_count or equivalent). Two leaderboards: by likes and by listens.
  - `POST /api/songs/:id/leaderboard-like`: record a leaderboard like (one per user per play). Client sends `playId` or backend infers last play of this song for this user within a time window; idempotent.
  - Existing `POST /api/songs/:id/like` and `DELETE /api/songs/:id/like`: treat as **saved songs** (one per user per song); keep current behavior.
- **Spotlight listens (unlimited replay counting)**
  - `POST /api/spotlight/listen` or `POST /api/songs/:id/spotlight-listen`: body `{ context: 'featured_replay' | 'artist_of_week' | 'artist_of_month' }`. Backend validates that the current user is allowed unlimited listening for that context (e.g. this artist is today’s featured / this week’s artist / this month’s artist) and that the song belongs to that artist; then records the listen (e.g. insert `spotlight_listens`, increment `spotlight_listen_count` on song). Used when user plays the featured song on artist page, or any song on artist-of-week/month page.
  - `GET /api/spotlight/can-listen-unlimited?artistId=...&songId=...`: returns whether the user can listen unlimited to this song/artist (featured song today, or artist of week this week, or artist of month this month). Client uses this to show “unlimited” and to call the listen endpoint on each play.
- **Radio play**
  - When reporting play `POST /api/radio/play`, backend already has `plays` row; return `playId` or expose it so client can call `POST /api/songs/:id/leaderboard-like` with `playId` (or backend derives from last play). Alternatively, leaderboard-like is allowed “once per user per song per calendar day” or “once per user per play_id”; implementation choice.
- **Voting (top 7)**
  - `GET /api/competition/current-week`: returns current week’s period (start/end date) and whether voting is open.
  - `POST /api/competition/vote`: body `{ songIds: [uuid1, …, uuid7] }` (order = rank 1–7). Validates 7 songs, period, one submission per user per week; stores in `weekly_votes` (or equivalent).
  - `GET /api/competition/weekly-results?period=YYYY-MM-DD`: results for a week (top 7, winner); optionally restricted to after voting closes.
- **News and promotions**
  - `GET /api/feed/news-promotions?limit=10`: returns active news and promotions (within starts_at/ends_at), e.g. for the competition page. Can be implemented via backend (Supabase client) or, for real-time, **Supabase MCP** / Supabase Realtime subscription from the client.
- **Artist spotlight**
  - `GET /api/spotlight/today`: returns today’s featured artist (and optional song).
  - `GET /api/spotlight/week?start=YYYY-MM-DD`: returns 7 days of spotlight artists (for “this week’s lineup”).
- **Artist of the month / year**
  - `GET /api/competition/monthly-winners?year=&month=`: list monthly winners.
  - `GET /api/competition/yearly-winners?year=`: list yearly winners.
  - End-of-month vote: e.g. `POST /api/competition/vote-monthly` (vote among weekly winners of the month); same for year. Exact endpoints can be one “vote” endpoint with type week|month|year.

**New modules (NestJS)**

- `SuggestionsModule` (or extend `UsersModule`): local-artists suggestion.
- `LeaderboardModule`: leaderboard songs + leaderboard-like; or under `SongsModule`.
- `CompetitionModule`: weekly vote, weekly results, monthly/yearly winners and votes.
- `SpotlightModule`: today’s spotlight, week lineup.

**Scheduled jobs**

- Close weekly voting at end of week; compute top 7 and weekly winner; assign 7 spotlight days (e.g. next week).
- End of month: open monthly vote among weekly winners; close and set Artist of the Month.
- End of year: open yearly vote among monthly winners; close and set yearly winner (prize).

---

## 5. Frontend (Web and Mobile)

- **First page after login: Competition / Spotlight**
  - **Default post-login route:** After login, users land on the **competition/spotlight** screen (not the generic dashboard). This is the main landing experience.
  - **Content on this screen:** (1) **Leaderboards** — show both **by likes** and **by listens** (tabs or two sections). (2) **Featured artists** — e.g. today’s spotlight and this week’s lineup; click into an artist to go to their page. (3) **Voting** — “Vote for Top 7” UI on this same screen (pick 7 songs, rank 1–7, submit). (4) **News and promotions** — display a dedicated area (e.g. ticker, cards, or carousel) fed by `GET /api/feed/news-promotions` or Supabase. Optionally a block for “Artists in your area” if `suggestLocalArtists` is true.
  - **Dynamic, shifting, and changing UI:** Use **dynamic, moving, and changing elements** for a **modern, futuristic, sleek** feel: e.g. horizontal marquee or ticker for news/promotions; subtle motion (CSS animations or Framer Motion) on cards and leaderboard rows; staggered reveal on scroll; live-updating leaderboard positions (poll or Supabase Realtime). Build with **shadcn** (Card, Tabs, Badge, Skeleton, etc.) for consistency and accessibility; use **Supabase** for data and optional real-time; **Firebase** for auth. When implementing, use **shadcn MCP**, **Supabase MCP**, and **Firebase MCP** as needed for components, schema, and patterns.
- **Artist page (featured / spotlight)**
  - When user **clicks into** a featured artist’s page from the competition screen: show their **featured song** with an **unlimited replay** control — user can listen as many times as they want. Each play is sent to `POST /api/spotlight/listen` (or equivalent) with context `featured_replay` so it **counts** toward the **listens leaderboard**.
- **Artist of the Week page**
  - Dedicated view for the current Artist of the Week. On **their page**, user can listen to **all that artist’s music unlimited for that week**. Each play is recorded with context `artist_of_week` and counts toward the listens leaderboard.
- **Artist of the Month page**
  - Dedicated view for the current Artist of the Month. On **their page**, for the **next month** (the month following their win), users get **unlimited listens** to all their music. Each play is recorded with context `artist_of_month` and counts toward the listens leaderboard.
- **Profile/settings**
  - Add region selector or auto-detect and “Suggest artists in my area” toggle; persist via `PATCH /api/users/me`.
- **Leaderboard (on competition screen)**
  - **By likes:** list songs by leaderboard like count; “Like” (leaderboard) and “Save” (saved song). When a song **plays** on radio, enable “Like for leaderboard” once per that play.
  - **By listens:** separate list of songs ranked by listen count (spotlight_listen_count). Read-only for display; no like button here.
- **Radio player**
  - When current song plays: allow “Like (for leaderboard)” once per this play; “Save” uses existing like API. Clear labels: “Like for leaderboard” vs “Save to my songs”.
- **Competition (on same landing screen)**
  - “Vote for Top 7” on the competition/spotlight screen; show current week period and “Voting closes …”.
  - “Artist of the Week” / “This week’s spotlight”: show 7 days and which artist is featured which day; link to today’s spotlight and to artist-of-week and artist-of-month pages.
- **Artist spotlight**
  - “Today’s spotlight: [Artist]” with CTA to open their page and listen to the featured song unlimited.

---

## 6. Documentation and README

- **New doc: [docs/planned-implementation-competition.md**](docs/planned-implementation-competition.md)  
  - Purpose: “Planned implementation: competition, spotlight, local suggestions.”
  - Sections: business model shift (freshman-cypher style, not Spotify); feature list (local suggestions, top 7 vote, spotlight, leaderboard vs saved, week→month→year, prizes); data model summary (tables/columns above); API summary (endpoints above); UI flows (login suggestion, settings, leaderboard, voting, spotlight); and “Status: planned (not yet implemented).”
- **Update [README.md**](README.md)
  - Add a **“Planned Implementation”** section (e.g. after “Temporarily Disabled Features” or after “Features Implemented”) that:
    - States the **business model shift**: from competing with Spotify to an **online music popularity competition** (freshman-cypher style) with community artist engagement and later live shows/events.
    - Lists the **planned features** in short form: **competition/spotlight as first page after login** (leaderboards by likes and by listens, featured artists, voting, **news and promotions**); **dynamic shifting, moving, and changing UI** (modern, futuristic, sleek) using **shadcn**, **Supabase**, and **Firebase** (MCP as needed); unlimited listening to featured song and to Artist of the Week/Month pages, with listens counted; location-based artist suggestions (optional); Top 7 voting and ranking; daily artist spotlight; separate leaderboards by likes and by listens; saved songs; Artist of the Month/Year and prizes.
    - Links to **Full plan**: [docs/planned-implementation-competition.md](docs/planned-implementation-competition.md).

---

## 7. Implementation Order (Suggested)

1. **Docs and README** — Add [docs/planned-implementation-competition.md](docs/planned-implementation-competition.md) and README “Planned Implementation” section (no code yet).
2. **Data model** — Migrations: user `region`, `suggest_local_artists`; artist region; `leaderboard_likes`; `weekly_votes`; `artist_spotlight` (with featured `song_id`); `weekly_winners`, `monthly_winners`, `yearly_winners`; `spotlight_listens` and `songs.spotlight_listen_count`; `**news_promotions**` (news and promotions for competition page). Use **Supabase MCP** for schema/migrations as needed.
3. **Users API** — Extend `PATCH/GET /api/users/me` for region and suggest_local_artists.
4. **Suggestions API** — `GET /api/suggestions/local-artists` and wire after login.
5. **Leaderboard** — Leaderboard likes (per play) + `GET /api/leaderboard/songs?by=likes`; add `GET /api/leaderboard/songs?by=listens` (separate listens leaderboard); clarify saved vs leaderboard in client.
6. **Spotlight listens** — `POST /api/spotlight/listen` (or per-song) and `GET /api/spotlight/can-listen-unlimited`; record featured replay, artist-of-week, artist-of-month plays; increment spotlight_listen_count.
7. **Competition APIs** — Weekly vote and results; spotlight today/week (with featured song); monthly/yearly winners and votes.
8. **News and promotions** — Supabase table `news_promotions` (via migration/MCP); `GET /api/feed/news-promotions` (or client Supabase query); optional Realtime for live updates.
9. **Scheduled jobs** — Close weekly vote, assign spotlight, monthly/yearly aggregation and votes.
10. **Web UI** — Post-login default route to **competition/spotlight** page (first screen). That page: leaderboards (likes + listens), featured artists, voting, **news and promotions** area; **dynamic shifting/moving/changing elements** (marquees, motion, staggered reveals, live-updating leaderboard). Use **shadcn** components and **Supabase**/ **Firebase** (and **shadcn**, **Supabase**, **Firebase MCP** as needed) for a modern, futuristic, sleek look. Artist pages: unlimited featured song; artist-of-week and artist-of-month pages with unlimited listening. Login suggestion block optional.
11. **Mobile UI** — Same flows: competition/spotlight as first screen, leaderboards, voting, news/promotions, and artist pages with unlimited listening; apply similar dynamic/motion patterns where supported.

---

## 8. Diagram (Conceptual)

```mermaid
flowchart LR
  subgraph login [On Login]
    A[User logs in] --> B{suggest_local_artists?}
    B -->|Yes| C[GET local-artists]
    C --> D[Show "Artist in your area"]
    B -->|No| E[Skip suggestion]
  end

  subgraph engagement [Engagement]
    F[Radio plays song] --> G[Like for leaderboard once per play]
    F --> H[Save to my songs once per song]
    G --> L[Leaderboard]
    H --> S[Saved songs]
  end

  subgraph competition [Competition]
    V[Vote Top 7 weekly] --> W[Weekly winners]
    W --> X[7 spotlight days]
    W --> M[Vote Artist of Month]
    M --> Y[Monthly winner]
    Y --> N[Vote Artist of Year]
    N --> Z[Yearly winner + prize]
  end
```



---

## 9. Open Decisions

- **Region granularity**: Country only, or country+region/city, or lat/lng for “near me”. Affects schema and suggestion query.
- **Leaderboard like scope**: Strict “one like per play_id” vs “one like per user per song per day” (simpler, less tied to play event). Recommend one-per-play for fairness.
- **Saved vs likes**: Keep current `likes` as “saved songs” and add `leaderboard_likes` (as above), or the reverse; plan assumes current `likes` = saved, new = leaderboard.
- **Listens leaderboard scope**: Only spotlight listens (featured replay + artist-of-week + artist-of-month) in the listens leaderboard, or also include radio plays. Plan assumes **separate** leaderboard for spotlight/listen count only.
- **News and promotions**: Admin UI to create/edit news and promotions vs. managing `news_promotions` directly in Supabase (e.g. via dashboard or MCP). Plan assumes table in Supabase; admin UI can be added later.
- **Dynamic UI**: Use **shadcn MCP** for component patterns (e.g. Carousel, Marquee, Skeleton); **Supabase MCP** for schema and real-time if leaderboard/news updates live; **Firebase MCP** for auth patterns. Keep motion accessible (prefer-reduced-motion).
- **Prize mechanics**: Cash payout, badge, or other — out of scope for this plan except “winner gets opportunity/prize” in copy and docs.

Once you confirm this plan (and any doc/README wording preferences), the next step is to add the planned-implementation doc and README section as specified above; implementation can then follow the suggested order.