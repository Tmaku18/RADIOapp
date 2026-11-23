# Branding & Product Terminology

This document defines the user-facing product terminology and logo used across the web app, marketing copy, and documentation. Backend (API paths, DB columns, role values) may still use technical names for compatibility.

## Truth-safe positioning (read first)

Per the NETWORX Updated Truth-Safe Branding Document, public copy must advertise what is active now and describe future capability as roadmap only. NETWORX is a **music discovery marketplace and creative networking platform** (music = 30-second previews + purchased full-track access; PRO-NETWORX = creative services/networking).

- "Radio" is allowed as a **brand/discovery concept** ("NETWORX Radio is our music discovery side"). Do **not** imply a licensed radio station/broadcaster.
- Use "community rankings" / "leaderboards", not "charts" — never imply **official chart reporting** (Billboard/Luminate/SoundExchange) or **radio royalties**.
- Avoid outcome guarantees (fame, income, guaranteed listeners). Hedge discovery metrics ("target", "roughly").
- Prefer "radio-style shared listening" over "real radio"; prefer "Artist Discovery Placement" over "buy airtime".

## The three metaphor systems

All Networx terminology hangs off three connected metaphors. This grouping is the source of truth for the "Language of Networx" glossary shown on the web landing page (`web/src/app/(marketing)/page.tsx`) and the mobile About screen (`mobile/lib/features/about/about_screen.dart`). Keep all three in sync.

### 1. The Butterfly Effect — *one small ripple can become a storm*

- **The Butterfly Effect**: A single vote or discovery can set off the chain reaction that launches an artist's career. Also the product's name/tagline and logo line ("NETWORX RADIO — The Butterfly Effect").
- **Ripples**: The audience's votes/likes; each ripple carries an artist's sound further. (Technical: `likes`.)
- **The Wake**: The artist analytics report — "the path left behind by a thousand Ripples." (Technical: analytics/stats.)

### 2. Metamorphosis — *the journey from unseen talent to recognized artist*

- **Metamorphosis**: The transformation an artist undergoes on Networx, from an unknown upload to a name the people know.
- **Artist**: A creator who uploads music and grows through radio + community. (Technical: role `artist`. Legacy UI term: Gem.)
- **Diamond**: An artist refined under pressure — a standout the community has voted into the spotlight (competition/featured).
- **Producer**: A creative service provider (producer, photographer, mentor) who accelerates the metamorphosis via Pro-Networx. (Technical: role `service_provider`. Pro-Networx marketing still calls service providers Catalysts.)

### 3. Mining — *surfacing value from the live frequency*

- **Mining the Frequency**: How value is surfaced from the always-on stream — the people dig through the radio to find what shines.
- **Prospectors**: The listeners; they tune in, send Ripples, and refine raw songs into trustworthy signal. (Technical: role `listener`.)
- **The Refinery**: The portal where Prospectors rate, survey, and comment to refine songs artists submit for review. Planned: invite-only entry by raffle or referral, with capped seats. (Technical: `songs.in_refinery`, `reviewers`, `refinery_reviews`, `refinery_comments`; planned `refinery_membership`.)
- **Badge**: A trophy on a profile, with an optional perk. Shown in the trophy case and as a chip next to the display name on comments. (Technical: planned `badge_definitions`, `user_badges`.)
- **The Yield**: A Prospector's rewards — steady earnings from verified engagement. (Technical: `prospector_yield`.)

Detailed entries for each term follow below.

## Logo (Networx Radio — The Butterfly Effect)

- **Asset**: Place the official logo image at **`web/public/networx-logo.png`**. The logo shows the butterfly/equalizer graphic with “NETWORX”, “RADIO”, and “THE BUTTERFLY EFFECT” on a dark background.
- **Where used**: Marketing site header and footer (`web/src/app/(marketing)/layout.tsx`). If the image is missing, the UI falls back to the 🎧 + “Networx” text.
- **Alt text**: “Networx Radio — The Butterfly Effect”.

## Prospectors (audience / listeners)

- **Term**: **Prospectors** (singular: **Prospector**)
- **Meaning**: The audience—people who tune in, send Ripples, and refine songs into signal the market can trust.
- **Rationale**: “Ore to Diamond” hierarchy: Prospectors mine the Frequency to identify which songs have the potential to become Gems.
- **Where used**: Glossary (web landing and mobile About/welcome), home copy, artist stats (“Prospectors” count, “Prospector Heatmap”), admin users filter (“Prospectors”), Refinery copy, live-listener descriptions. Role selection, profile, and Settings label the role **Listener**.
- **Technical**: Role value remains `listener` in API/DB; `listener_count` unchanged.

## Ripples (engagement / likes)

- **Term**: **Ripples** (singular: **ripple** as verb: “send a ripple”)
- **Meaning**: User engagement—votes/likes on tracks. Each vote is a “ripple” that carries the artist’s sound.
- **Rationale**: Butterfly effect—the artist is the butterfly; the audience’s votes are the ripples. *“Every artist needs their Ripples to turn a spark into a storm.”*
- **Where used**: Home stats tile (“Ripples”), competition (“X ripples”), artist stats and analytics (“Ripples” during play, “Ripples per day”), admin (“Total Ripples”, “Ripples” column), web player check-in prompt, marketing/FAQ. The player itself votes with 🔥 / 💩 (fire / poop); the mobile vote animation is the “Butterfly Ripple”.
- **Technical**: API/DB still use `likes` table and `like` endpoints; only UI copy uses “Ripples”.

## The Wake (analytics report)

- **Term**: **The Wake**
- **Tagline**: *“The path left behind by a thousand Ripples.”*
- **Meaning**: The artist analytics report—Listens, Ears Reached, new followers, engagement, Prospector heatmap, top songs.
- **Where used**: Glossary, marketing features and pricing (“The Wake - Transparent Analytics”), FAQ, welcome screen. In the app the nav item and page title read **Analytics** (`/artist/stats` on web, Analytics screen on mobile).

## The Yield (Prospector rewards)

- **Term**: **The Yield**
- **Meaning**: Slow, steady Prospector earnings from verified engagement (sync time, refinement, surveys, feedback; $0.10 per Refinery review). Redeemable for a Virtual Visa at $5, $10, or $25, or for merch or boost credits at $10 or $25.
- **Where used**: Rewards page (`/yield`, under More), redemption UI, and engagement prompts.
- **Technical**: `prospector_yield` balance and `prospector_redemptions`; does not change artist placement budgets.

## Songs (tracks)

- **Term**: **Songs** (singular: **song**)
- **Meaning**: Tracks—the content artists upload and that Prospectors hear and ripple.
- **Rationale**: Clear, direct terminology for artist uploads and catalog.
- **Where used**: "My Songs", "Upload New Song", "Song Title", table headers ("Song"), admin ("Songs", "Total Songs", "Song Moderation", "Search Songs"), competition ("7 songs", "song IDs"), empty states ("No songs yet"), RadioPlayer ("No songs are currently available").
- **Technical**: URLs remain `/artist/songs`, `/admin/songs`; API and DB use `song`, `songs`, `song_id`, etc.

## The Refinery (Prospector portal)

- **Term**: **The Refinery**
- **Meaning (today)**: Artists submit an approved song for an in-depth review ($4.99, free during beta) with up to 10 custom questions. Reviewers hear the song, answer ratings and survey questions, and leave comments to earn Yield. Each submission targets at least 100 reviews. Any signed-in user can sign up as a reviewer.
- **Meaning (planned)**: Invite-only. Entry is by raffle or by referral from someone already inside, and both pass a capacity check so Yield stays payable. The first 100 reviewers are recruited from people artists already respect. That bench is not the merch Founding 100.
- **Where used**: Nav (“The Refinery”), Refinery page and review/analytics pages (web + Flutter), My Songs (“Add to Refinery”).
- **Technical**: `songs.in_refinery`, `reviewers`, `refinery_reviews`, `refinery_custom_questions`, `refinery_comments`; `/refinery/songs`, `/refinery/songs/:id/submit`, `/add`, `/remove`, `/review`, `/analytics`, `/comments`, `/refinery/reviewer/signup`. Planned membership: `refinery_membership` with source `raffle`, `referral`, or `founding_reviewer`. See [badges and Refinery access](business/badges-and-refinery-access.md).
- **Public line**: Earn Yield for verified Refinery work. Seats are limited. Enter the raffle, or get referred by someone already inside. Do not ship “get paid to listen” as a slogan.

## Badge (trophy)

- **Term**: **Badge**
- **Meaning**: A trophy someone earns and shows off. Each badge lives in a catalog, has its own way to be earned, and may carry a perk. The beta badge goes to every account created while beta is open and stays after beta ends. The full set sits in a trophy case on the profile. A chip sits next to the display name on comments (Refinery comments first, then chat and other comment surfaces). When someone holds several badges, the chip shows the primary one.
- **Where used**: Profile trophy case; name chip on Refinery comments, chat, and other comments. Not built yet.
- **Technical**: Planned `badge_definitions` and `user_badges`. No perk menu in the strategy; perks are set per badge when that badge is added.

## Metamorphosis (artist transformation)

- **Term**: **Metamorphosis**
- **Meaning**: The artist's journey from an unknown upload to a recognized name. Frames the whole product experience as a transformation rather than a static catalog.
- **Where used**: Marketing glossary ("Metamorphosis" group), About screen (web + mobile).
- **Technical**: No direct DB field; narrative grouping for `Gem` -> `Diamond` progression.

## Gem (artist)

- **Term**: **Gem** (a "hidden gem")
- **Meaning**: An artist; talent ready to be heard and refined by the community.
- **Status**: Legacy. Role labels and the glossary say **Artist**. Gem remains in some copy: "hidden gem" on home, "The Gems" artist gallery, "Gems in your area" on the competition page, "Gem Home" on the web dashboard, the Metamorphosis story, and the admin "Gems" count.
- **Technical**: Role value remains `artist`.

## Diamond (spotlighted artist)

- **Term**: **Diamond**
- **Meaning**: An artist refined under pressure — a standout the community has voted into the spotlight.
- **Where used**: Competition/Spotlight ("Diamonds"), leaderboard features, glossary.
- **Technical**: Derived from competition/leaderboard standings; no dedicated column.

## Catalyst (service provider)

- **Term**: **Catalyst** (plural **Catalysts**)
- **Meaning**: A creative service provider — producer, photographer, mentor — who accelerates an artist's metamorphosis through Pro-Networx mentorship and services.
- **Where used**: Pro-Networx marketing and directory ("Hire a Catalyst", "Industry Catalysts", landing stat "Catalysts"), Discover people tab ("Catalysts"), artist Services page, About story ("The 4 AM Catalyst"). Role selection, profile, and the glossary label the role **Producer**.
- **Technical**: Role value remains `service_provider`; pinned credits on a track are `pinned_catalysts`.

## Maker roles

- **Terms**: **Artist**, **Producer**, **Instrumentalist**, **DJ** (plus **Listener** for everyone else).
- **Meaning**: What someone makes. One account can hold several maker roles at once; any maker role can upload.
- **Where used**: Signup ("Leave these unchecked to join as a listener"), Settings, profile, admin users.
- **Technical**: `artist`, `service_provider`, `musician`, `dj`, `listener`; `users.role` holds the first maker role and `userRoles` holds all of them.

## Temperature (Popular and Peer)

- **Term**: **Temperature**, shown as two lines: **Popular** and **Peer**
- **Meaning**: How hot a song is running from 🔥 / 💩 votes, 0–100. Popular comes from listener votes; Peer comes from votes by makers. Each line can show the 1–10 average rating next to it.
- **Where used**: Radio player strip under the title (web + mobile), song stories area.
- **Technical**: `temperaturePercent`, `popularTemperature`, `peerTemperature`; voter cohort in `common/vote-integrity.ts`.

## Mining the Frequency (discovery)

- **Term**: **Mining the Frequency** (a.k.a. **Mining**)
- **Meaning**: The act of surfacing value from the always-on live stream — Prospectors dig through the radio to find songs worth refining.
- **Where used**: Marketing glossary ("Mining" group), About screen.
- **Technical**: Conceptual umbrella over radio playback + Prospector/Refinery engagement.

## Live Sync Chat (real-time room)

- **Term**: **Live Sync Chat**
- **Meaning**: Real-time chat where fans join an artist or DJ "in the room" during a livestream or live session.
- **Where used**: Marketing (For Gems), FAQ, player/livestream UI.

## Artist Discovery Placement (paid promotion)

- **Term**: **Artist Discovery Placement** (a.k.a. discovery placement)
- **Meaning**: A paid promotion that seeds a track into the discovery pipeline with a *target* (not guaranteed) delivery of about 100 verified listener exposures per placement. One placement is $1.99. Packs are $4.99 (3), $9.99 (5), $17.99 (10), $39.99 (25), $75.99 (50), and $150 (100), the same on the website and in the app. Packs of 3 or more include free placements. Replaces any "buy airtime" framing to avoid radio-royalty confusion.
- **Where used**: Marketing (For Gems), FAQ, pricing, artist dashboard.

## Listens (discovery metric)

- **Term**: **Listens**
- **Meaning**: People who heard a song — counted once per song per person (unique song–listener pairs). Same account on three songs = three listens. Includes radio, profile, and spotlight playback.
- **Where used**: Dashboard, artist analytics, competition leaderboard, trending cards, marketing stats.

## Ears Reached (discovery metric)

- **Term**: **Ears Reached**
- **Meaning**: Unique people who heard a song. The same account counts once and the total does not reset. A guest counts once per visit, even if the radio loops back to the song.
- **Where used**: Marketing live stats, dashboard, artist analytics, My Songs reach, mobile About/welcome strips.

## Unique Listeners (analytics metric)

- **Term**: **Unique Listeners**
- **Meaning**: Every time someone hears a song, including the same person again. Shown all time, per day, this week, and this month.
- **Where used**: Artist analytics (web + mobile).

## Plays (internal / optional)

- **Term**: **Plays** (formerly “Spins” in the UI; not shown as “Listens”)
- **Meaning**: Raw radio play events from the `plays` table.
- **Where used**: Admin diagnostics, per-song “Plays” line in analytics detail — not a user-facing “Listens” total.

## Summary table

| User-facing term | Technical / backend |
|------------------|---------------------|
| Prospector(s)    | listener, listener_count (role label: Listener) |
| Artist (legacy: Gem) | role `artist`   |
| Diamond          | competition/leaderboard standing |
| Producer; Catalyst(s) in Pro-Networx copy | role `service_provider` |
| Instrumentalist / DJ | role `musician` / `dj` |
| Temperature (Popular / Peer) | temperaturePercent, popularTemperature, peerTemperature |
| Ripple(s)        | like, likes         |
| The Wake         | analytics, stats, artist stats report |
| The Yield        | prospector_yield, prospector_redemptions |
| The Refinery     | songs.in_refinery, reviewers, refinery_reviews, refinery_comments, /refinery/*; planned refinery_membership |
| Badge            | planned badge_definitions, user_badges |
| Metamorphosis    | narrative (Artist -> Diamond progression) |
| Mining the Frequency | radio + Prospector/Refinery engagement |
| Songs            | song, songs         |
| Live Sync Chat   | live chat / livestream room |
| Artist Discovery Placement | discovery placement / promotion |
| Listens          | totalListenCount, get_radio_listen_count |
| Ears Reached     | earsReached, get_radio_ears_reached |
| Unique Listeners | uniqueListeners |
| Plays            | totalPlays, plays table |

Last updated: 2026-11-23
