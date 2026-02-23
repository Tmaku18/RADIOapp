# Branding & Product Terminology

This document defines the user-facing product terminology and logo used across the web app, marketing copy, and documentation. Backend (API paths, DB columns, role values) may still use technical names for compatibility.

## Logo (Networx Radio — The Butterfly Effect)

- **Asset**: Place the official logo image at **`web/public/networx-logo.png`**. The logo shows the butterfly/equalizer graphic with “NETWORX”, “RADIO”, and “THE BUTTERFLY EFFECT” on a dark background.
- **Where used**: Marketing site header and footer (`web/src/app/(marketing)/layout.tsx`). If the image is missing, the UI falls back to the 🎧 + “Networx” text.
- **Alt text**: “Networx Radio — The Butterfly Effect”.

## Prospectors (audience / listeners)

- **Term**: **Prospectors** (singular: **Prospector**)
- **Meaning**: The audience—people who tune in, send Ripples, and refine Ore's into signal the market can trust.
- **Rationale**: “Ore to Diamond” hierarchy: Prospectors mine the Frequency to identify which Ore’s have the potential to become Gems.
- **Where used**: Marketing (“For Prospectors”), role selection (“Prospector”), artist stats (“Prospectors” count, “Prospector Heatmap”), admin user role label (“Prospector”), FAQ (“For Prospectors”).
- **Technical**: Role value remains `listener` in API/DB; `listener_count` unchanged.

## Ripples (engagement / likes)

- **Term**: **Ripples** (singular: **ripple** as verb: “send a ripple”)
- **Meaning**: User engagement—votes/likes on tracks. Each vote is a “ripple” that carries the artist’s sound.
- **Rationale**: Butterfly effect—the artist is the butterfly; the audience’s votes are the ripples. *“Every artist needs their Ripples to turn a spark into a storm.”*
- **Where used**: Player (“Ripple” button), competition (“By Ripples”, “X ripples”), artist stats (“Ripples” during play, “X ripples” per ore), admin (“Total Ripples”, “Ripples” column), marketing/FAQ (“send ripples”).
- **Technical**: API/DB still use `likes` table and `like` endpoints; only UI copy uses “Ripples”.

## The Wake (analytics report)

- **Term**: **The Wake**
- **Tagline**: *“The path left behind by a thousand Ripples.”*
- **Meaning**: The artist analytics report—discoveries, engagement, Prospector activity, ROI, heatmap, top ore's.
- **Where used**: Nav (“The Wake”), artist stats page title and subtitle, dashboard card (“The Wake”), FAQ (“The Wake (in your gem dashboard)”), notifications (“View The Wake”), marketing For Gems (“The Wake” step).

## The Yield (Prospector rewards)

- **Term**: **The Yield**
- **Meaning**: Slow, steady Prospector earnings from verified engagement (sync time, refinement, surveys, feedback). Redeemable at thresholds (e.g. $10 / $25) for rewards like virtual gift cards or merch.
- **Where used**: Prospector dashboard (“The Yield”), redemption UI, and engagement prompts.
- **Technical**: Stored as a Prospector balance/ledger in new tables; does not change artist play credits.

## Ore's (tracks / songs)

- **Term**: **Ore's** (singular: **ore**)
- **Meaning**: Tracks/songs—the content artists upload and that Prospectors hear and ripple.
- **Rationale**: Fits the gem/mining metaphor (Gems = artists; Ore's = their tracks).
- **Where used**: "My Ore's", "Upload New Ore", "Ore Title", table headers ("Ore"), admin ("Ore's", "Total Ore's", "Ore Moderation", "Search Ore's"), competition ("7 ore's", "ore IDs"), empty states ("No ore's yet"), RadioPlayer ("No ore's are currently available").
- **Technical**: URLs remain `/artist/songs`, `/admin/songs`; API and DB still use `song`, `songs`, `song_id`, etc.

## The Refinery (Prospector portal)

- **Term**: **The Refinery**
- **Meaning**: A portal where artists select uploaded songs to be considered for review. Listeners can sign up to be Prospectors to hear songs in The Refinery unlimited times, answer survey questions, rank (1–10), and leave comments to get rewards. Regular listeners do not have access.
- **Where used**: Nav (“The Refinery”), Refinery page (web + Flutter), artist Studio (“Add to Refinery” / “Remove from Refinery” on My Ore's).
- **Technical**: `songs.in_refinery`, `refinery_comments` table; `/refinery/songs`, `/refinery/songs/:id/add`, `/refinery/songs/:id/remove`, `/refinery/songs/:id/comments`. Rank/survey/rewards use existing Prospector Yield (refinement, survey).

## Summary table

| User-facing term | Technical / backend |
|------------------|---------------------|
| Prospector(s)    | listener, listener_count |
| Ripple(s)        | like, likes         |
| The Wake         | analytics, stats, artist stats report |
| The Yield        | prospector_yield, prospector_redemptions |
| The Refinery     | songs.in_refinery, refinery_comments, /refinery/* |
| Ore's            | song, songs         |

Last updated: February 2026.
