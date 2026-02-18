# Branding & Product Terminology

This document defines the user-facing product terminology used across the web app, marketing copy, and documentation. Backend (API paths, DB columns, role values) may still use technical names for compatibility.

## Flutters (audience / listeners)

- **Term**: **Flutters** (singular: **Flutter**)
- **Meaning**: The audience—people who tune in, vote, and engage with the radio stream.
- **Rationale**: Ties to the “butterfly” / movement metaphor: the small initial movement that starts a chain reaction. *“Be the Flutter that starts the storm.”*
- **Where used**: Marketing (“For Flutters”), role selection (“Flutter”), artist stats (“Flutters” count, “Flutter Heatmap”), admin user role label (“Flutter”), FAQ (“For Flutters”).
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
- **Meaning**: The artist analytics report—discoveries, engagement, Flutter activity, ROI, heatmap, top ores.
- **Where used**: Nav (“The Wake”), artist stats page title and subtitle, dashboard card (“The Wake”), FAQ (“The Wake (in your gem dashboard)”), notifications (“View The Wake”), marketing For Gems (“The Wake” step).

## Ores (tracks / songs)

- **Term**: **Ores** (singular: **ore**)
- **Meaning**: Tracks/songs—the content artists upload and that Flutters hear and ripple.
- **Rationale**: Fits the gem/mining metaphor (Gems = artists; Ores = their tracks).
- **Where used**: “My Ores”, “Upload New Ore”, “Ore Title”, table headers (“Ore”), admin (“Ores”, “Total Ores”, “Ore Moderation”, “Search Ores”), competition (“7 ores”, “ore IDs”), empty states (“No ores yet”), RadioPlayer (“No ores are currently available”).
- **Technical**: URLs remain `/artist/songs`, `/admin/songs`; API and DB still use `song`, `songs`, `song_id`, etc.

## Summary table

| User-facing term | Technical / backend |
|------------------|---------------------|
| Flutter(s)       | listener, listener_count |
| Ripple(s)        | like, likes         |
| The Wake         | analytics, stats, artist stats report |
| Ore(s)           | song, songs         |

Last updated: February 2026.
