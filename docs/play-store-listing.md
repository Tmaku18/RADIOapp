# Google Play Store Listing — Networx Radio (Android)

**Last updated:** 2026-11-23  
**Replaces:** `play-store-listing.pdf` (generated listing for “RADIOapp” — outdated, no longer in the repo)  
**App version this copy matches:** 1.0.99 (133)

Use this document as the canonical Play Console copy. It is aligned with the current mobile app (`mobile/`), backend (`backend/`), and product terminology (`docs/branding-terminology.md`, `docs/features-summary.md`).

---

## Implementation audit (PDF vs current build)

| PDF claim | Current status | Listing action |
|-----------|----------------|----------------|
| App name **RADIOapp** | Product is **Networx Radio** (`NETWORX Radio: The Butterfly Effect`) | **Updated** title and copy |
| **Spotify login** | Not implemented — Google, Apple, and email auth only | **Removed** |
| Main radio = artists “broadcasting live” | Always-on **synchronized democratic radio**; separate **artist livestreams** (DJ / performances) | **Clarified** |
| Generic **credits** boosts | **Discovery placements** per song: **$1.99** for 1, **$4.99** for 3, **$9.99** for 5, **$17.99** for 10, **$39.99** for 25, **$75.99** for 50, **$150** for 100 (~100 verified exposures each, bonus placements on packs). Credit packs are no longer sold. | **Clarified** |
| No **ProNetworx** | Full Pro-Networx shell: profiles, feed, services, directory, studios, job board, messaging (subscription) | **Added** |
| No **The Refinery** / **The Yield** | Both shipped on mobile (The Yield appears as **Rewards**) | **Added** |
| No direct **song sales** | 30-second preview + purchase full track | **Added** |
| “Thousands of artists / millions of reactions” | Unverified marketing claims | **Removed** — use honest launch language |
| Android label `radio_app` | Manifest still used internal slug | **Fixed** → `Networx Radio` |

---

## App identity (Play Console)

| Field | Value |
|-------|-------|
| Store listing title | See below (30 chars max) |
| Package name | `com.tmaktechnologies.networxradio` |
| Company | DISCOVERMERADIO GROUP LLC |
| Privacy policy | `https://www.networxradio.com/privacy` |
| Terms | `https://www.networxradio.com/terms` |
| Account deletion | `https://www.networxradio.com/delete-account` |
| Support email | `support@networxradio.com` |
| Category | Music & Audio (primary), Entertainment (secondary) |
| Price | Free |
| Contains ads | No. The app does not show ads and the Android manifest removes `AD_ID`. |
| In-app purchases | Yes — discovery placements, song and beat purchases, livestream tips, Refinery submissions, and the Pro-Radio, Pro-Networx, and Pro Bundle subscriptions, all through Google Play Billing. |

See also: `docs/google-play-app-content-packet.md`, `docs/legal/mobile-store-compliance-packet.md`

---

## App Title (30 characters max)

```
Networx Radio: Live & Network
```

**Character count:** 29

---

## Short Description (80 characters max)

```
Discover indie gems on live radio. Vote, chat, leaderboards, and ProNetworx.
```

**Character count:** 76

---

## Full Description (4000 characters max)

```
The Pulse of Independent Music — By Artists, For Artists

Networx Radio is the live democratic radio platform for the next generation of music. Everyone on a station hears the same always-on stream at the same time — no lonely algorithms, no gatekeepers. Discover hidden gems, send Ripples, vote fire or pass on what is playing, and help decide what rises on the leaderboards.

Whether you are a Prospector tuning in or a Gem ready to be heard, Networx turns listening into an interactive music community. One account also unlocks ProNetworx — the professional networking hub for creatives.

KEY FEATURES

• Always-On Democratic Radio — Genre stations from rap, hip hop, and R&B to country, rock, gospel, and more, including Clean Rap Radio.

• Fire or Pass Voting — Vote on every track, rate songs 1–10, and comment on each song. Votes drive a live temperature score and the rankings.

• Clips and Song Stories — Record a clip with the song that is on, add the artist credit and your own words, and share it as a story, in a DM, or to Instagram.

• Discover — Swipe through song clips and find artists by popularity, song count, or what is new.

• Pro-Radio — Play full songs on demand, build playlists, and record any moment of a song.

• Leaderboards & Competition — Climb weekly ranks by Ripples, listens, votes, saves, and Trial by Fire.

• Live Chat and DMs — Chat on every station, join The Chat Room, and message artists and fellow Prospectors.

• Livestreams — Watch Live Performances and Live DJ sets with real-time chat.

• The Wake (Artist Analytics) — Plays, ears reached, likes, and new followers for each song.

• Discovery Placements — Artists buy placements for a song: one for $1.99, or packs of 3 for $4.99, 5 for $9.99, 10 for $17.99, 25 for $39.99, 50 for $75.99, and 100 for $150, with bonus placements on packs. Each targets ~100 verified listener exposures.

• Direct-to-Fan Sales — Free 30-second previews; fans buy full tracks and beats to play and download.

• The Refinery — Prospectors refine songs through surveys, rankings, and feedback.

• Rewards (The Yield) — Prospectors earn rewards from verified engagement.

• ProNetworx — Profiles, a feed for photos, video, and audio, services, a directory, job board, studios, and messaging for every kind of creative. Find studios and creatives on the Nearby map.

• Listen Anywhere — Background playback, a Now Playing home screen widget, and stations in Android Auto. Song, artist, and station links open in the app.

• Sign In Your Way — Google, Apple, or email, or browse as a guest and sign in when you want to vote, follow, or chat.

FOR GEMS (ARTISTS)

Upload music, group songs into albums, promote with discovery placements, track The Wake, go live, sell tracks and beats direct, and compete on leaderboards. Connect with Catalysts on ProNetworx for production, visuals, and mentorship.

FOR PROSPECTORS (LISTENERS)

Listening is free — always. Vote in real time, send Ripples, chat, share clips, follow favorites, earn Rewards, and crown the next breakout gem.

COMMUNITY

Report or block anyone from a profile, post, song, chat, or live room.

Download Networx Radio and feel the Butterfly Effect — where one connection can change everything.

Networx Radio is free to download and use, with no ads. Discovery placements, song and beat purchases, livestream tips, Refinery submissions, Pro-Radio, ProNetworx, and the Pro Bundle are in-app purchases. Prices are shown in the app. Subscriptions renew automatically until you cancel in your Google Play account.
```

**Character count:** 3544

---

## What's New — 1.0.99 (500 characters max)

```
Version 1.0.99

• Browse as a guest and sign in only when you act
• Record a clip of the song on air and share it as a story, in a DM, or to Instagram
• Comments, 1–10 ratings, and report reasons on every radio song
• Share artist and Pro profiles; links open in the app
• Search as you type, with artist cards sorted by popularity, songs, or recent
• Swipe down to close the player; fire and pass on the mini player
• Text-code sign-in check, and 48 hours to undo account deletion
```

**Character count:** 481

---

## Keywords / Tags (ASO)

```
networx, networx radio, indie music, independent artists, live radio, music streaming, discover new music, underground music, emerging artists, music app, radio app, music discovery, artist platform, music community, vote music, music charts, indie radio, unsigned artists, music competition, listener voting, live music, streaming app, temperature score, music leaderboard, chat music, free music app, music analytics, radio streaming, pronetworx, creative network, the refinery, the yield, butterfly effect, ripples, prospectors, gems, catalysts
```

**Total:** 37 keywords

### Keyword strategy

| Priority | Keywords | Rationale |
|----------|----------|-----------|
| High volume | music streaming, live radio, discover new music, radio app, music app | Broad discovery |
| Brand | networx, networx radio, pronetworx, butterfly effect | Own the brand |
| Niche | indie music, independent artists, underground music, unsigned artists | Target audience |
| Feature | vote music, temperature score, music leaderboard, the refinery, ripples | Differentiation |
| Action | music discovery, live streaming, creative network | High intent |

---

## Content rating justification

**Suggested rating:** Teen (13+)

- User-generated content (uploads, clips, stories, feed posts, livestreams, chat, DMs)
- Social features including public chat
- Voting terminology includes mild slang (fire / pass reactions)
- In-app purchases (discovery placements, song purchases, tips, subscriptions)
- Music may include explicit content; explicit labeling supported in product, plus Clean Rap Radio
- Not directed at children

---

## Character count summary

| Field | Limit | Used | Status |
|-------|-------|------|--------|
| App Title | 30 | 29 | OK |
| Short Description | 80 | 76 | OK |
| Full Description | 4000 | 3544 | OK |
| What's New | 500 | 481 | OK |

---

## Pre-submit checklist

- [ ] Paste copy from this file into Play Console → Main store listing
- [x] `android:label` is **Networx Radio** (`mobile/android/app/src/main/AndroidManifest.xml`)
- [x] Package is `com.tmaktechnologies.networxradio`
- [x] Privacy, terms, legal, child-safety, and delete-account pages returned HTTP 200 on `www.networxradio.com` (2026-11-23). In-app links open `https://pro-networx.com/privacy` and `https://pro-networx.com/terms`, which redirect to `www.pro-networx.com` and also return 200.
- [ ] Upload screenshots that show **Networx** branding (not RADIOapp). Draft frames are in `store-assets/`; recapture from a device before upload.
- [ ] Feature graphic uses the official NETWORX butterfly wordmark (`store-assets/play-feature-graphic.jpg`)
- [ ] Data Safety: no ads, advertising ID not collected, account deletion is inside the app. Details in `docs/google-play-app-content-packet.md`.
- [ ] Play Billing product IDs match `backend/src/payments/iap-product-catalog.ts` (plus any `GOOGLE_PLAY_PRODUCT_CATALOG_JSON` overrides) and `mobile/lib/core/services/play_billing_service.dart`
- [x] Listing copy does not mention Spotify login or “RADIOapp”
