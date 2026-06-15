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
- **Gem**: An artist; a hidden gem ready to be heard and refined. (Technical: role `artist`.)
- **Diamond**: A Gem refined under pressure — a standout artist the community has voted into the spotlight (competition/featured).
- **Catalyst**: A creative service provider (producer, photographer, mentor) who accelerates the metamorphosis via Pro-Networx. (Technical: role `service_provider`.)

### 3. Mining — *surfacing value from the live frequency*

- **Mining the Frequency**: How value is surfaced from the always-on stream — the people dig through the radio to find what shines.
- **Prospectors**: The listeners; they tune in, send Ripples, and refine raw songs into trustworthy signal. (Technical: role `listener`.)
- **The Refinery**: The portal where Prospectors rank, survey, and comment to refine songs. (Technical: `songs.in_refinery`, `refinery_comments`.)
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
- **Where used**: Marketing (“For Prospectors”), role selection (“Prospector”), artist stats (“Prospectors” count, “Prospector Heatmap”), admin user role label (“Prospector”), FAQ (“For Prospectors”).
- **Technical**: Role value remains `listener` in API/DB; `listener_count` unchanged.

## Ripples (engagement / likes)

- **Term**: **Ripples** (singular: **ripple** as verb: “send a ripple”)
- **Meaning**: User engagement—votes/likes on tracks. Each vote is a “ripple” that carries the artist’s sound.
- **Rationale**: Butterfly effect—the artist is the butterfly; the audience’s votes are the ripples. *“Every artist needs their Ripples to turn a spark into a storm.”*
- **Where used**: Player (“Ripple” button), competition (“By Ripples”, “X ripples”), artist stats (“Ripples” during play, “X ripples” per song), admin (“Total Ripples”, “Ripples” column), marketing/FAQ (“send ripples”).
- **Technical**: API/DB still use `likes` table and `like` endpoints; only UI copy uses “Ripples”.

## The Wake (analytics report)

- **Term**: **The Wake**
- **Tagline**: *“The path left behind by a thousand Ripples.”*
- **Meaning**: The artist analytics report—discoveries, engagement, Prospector activity, ROI, heatmap, top songs.
- **Where used**: Nav (“The Wake”), artist stats page title and subtitle, dashboard card (“The Wake”), FAQ (“The Wake (in your gem dashboard)”), notifications (“View The Wake”), marketing For Gems (“The Wake” step).

## The Yield (Prospector rewards)

- **Term**: **The Yield**
- **Meaning**: Slow, steady Prospector earnings from verified engagement (sync time, refinement, surveys, feedback). Redeemable at thresholds (e.g. $10 / $25) for rewards like virtual gift cards or merch.
- **Where used**: Prospector dashboard (“The Yield”), redemption UI, and engagement prompts.
- **Technical**: Stored as a Prospector balance/ledger in new tables; does not change artist play credits.

## Songs (tracks)

- **Term**: **Songs** (singular: **song**)
- **Meaning**: Tracks—the content artists upload and that Prospectors hear and ripple.
- **Rationale**: Clear, direct terminology for artist uploads and catalog.
- **Where used**: "My Songs", "Upload New Song", "Song Title", table headers ("Song"), admin ("Songs", "Total Songs", "Song Moderation", "Search Songs"), competition ("7 songs", "song IDs"), empty states ("No songs yet"), RadioPlayer ("No songs are currently available").
- **Technical**: URLs remain `/artist/songs`, `/admin/songs`; API and DB use `song`, `songs`, `song_id`, etc.

## The Refinery (Prospector portal)

- **Term**: **The Refinery**
- **Meaning**: A portal where artists select uploaded songs to be considered for review. Listeners can sign up to be Prospectors to hear songs in The Refinery unlimited times, answer survey questions, rank (1–10), and leave comments to get rewards. Regular listeners do not have access.
- **Where used**: Nav (“The Refinery”), Refinery page (web + Flutter), artist Studio (“Add to Refinery” / “Remove from Refinery” on My Songs).
- **Technical**: `songs.in_refinery`, `refinery_comments` table; `/refinery/songs`, `/refinery/songs/:id/add`, `/refinery/songs/:id/remove`, `/refinery/songs/:id/comments`. Rank/survey/rewards use existing Prospector Yield (refinement, survey).

## Metamorphosis (artist transformation)

- **Term**: **Metamorphosis**
- **Meaning**: The artist's journey from an unknown upload to a recognized name. Frames the whole product experience as a transformation rather than a static catalog.
- **Where used**: Marketing glossary ("Metamorphosis" group), About screen (web + mobile).
- **Technical**: No direct DB field; narrative grouping for `Gem` -> `Diamond` progression.

## Gem (artist)

- **Term**: **Gem** (a "hidden gem")
- **Meaning**: An artist; talent ready to be heard and refined by the community.
- **Where used**: Marketing ("For Gems", "hidden gem"), role labels ("Gem"), glossary.
- **Technical**: Role value remains `artist`.

## Diamond (spotlighted artist)

- **Term**: **Diamond**
- **Meaning**: A Gem refined under pressure — a standout artist the community has voted into the spotlight.
- **Where used**: Competition/Spotlight ("Diamonds"), leaderboard features, glossary.
- **Technical**: Derived from competition/leaderboard standings; no dedicated column.

## Catalyst (service provider)

- **Term**: **Catalyst** (plural **Catalysts**)
- **Meaning**: A creative service provider — producer, photographer, mentor — who accelerates an artist's metamorphosis through Pro-Networx mentorship and services.
- **Where used**: About ("Catalysts (service providers)"), role selection ("Catalyst"), Pro-Networx, pinned credit lines ("Cover art by ...").
- **Technical**: Role value remains `service_provider`.

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
- **Meaning**: A paid promotion that seeds a track into the discovery pipeline with a *target* (not guaranteed) delivery of verified listener exposures. Replaces any "buy airtime" framing to avoid radio-royalty confusion.
- **Where used**: Marketing (For Gems), FAQ, pricing, artist dashboard.

## Ears Reached (discovery metric)

- **Term**: **Ears Reached**
- **Meaning**: A live discovery metric for how many listeners a track/stream has reached.
- **Where used**: Marketing landing live stats, mobile About stats strip.

## Summary table

| User-facing term | Technical / backend |
|------------------|---------------------|
| Prospector(s)    | listener, listener_count |
| Gem              | role `artist`       |
| Diamond          | competition/leaderboard standing |
| Catalyst(s)      | role `service_provider` |
| Ripple(s)        | like, likes         |
| The Wake         | analytics, stats, artist stats report |
| The Yield        | prospector_yield, prospector_redemptions |
| The Refinery     | songs.in_refinery, refinery_comments, /refinery/* |
| Metamorphosis    | narrative (Gem -> Diamond progression) |
| Mining the Frequency | radio + Prospector/Refinery engagement |
| Songs            | song, songs         |
| Live Sync Chat   | live chat / livestream room |
| Artist Discovery Placement | discovery placement / promotion |
| Ears Reached     | live discovery reach metric |

Last updated: June 2026 (truth-safe positioning added).
