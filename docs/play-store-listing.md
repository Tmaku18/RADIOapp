# Google Play Store Listing — Networx Radio (Android)

**Last updated:** 2026-11-01  
**Replaces:** `play-store-listing.pdf` (generated listing for “RADIOapp” — outdated)  
**App version this copy matches:** 1.0.87 (115)

Use this document as the canonical Play Console copy. It is aligned with the current mobile app (`mobile/`), backend (`backend/`), and product terminology (`docs/branding-terminology.md`, `docs/features-summary.md`).

---

## Implementation audit (PDF vs current build)

| PDF claim | Current status | Listing action |
|-----------|----------------|----------------|
| App name **RADIOapp** | Product is **Networx Radio** (`NETWORX Radio: The Butterfly Effect`) | **Updated** title and copy |
| **Spotify login** | Not implemented — Google, Apple, and email auth only | **Removed** |
| Main radio = artists “broadcasting live” | Always-on **synchronized democratic radio**; separate **artist livestreams** (DJ / performances) | **Clarified** |
| Generic **credits** boosts | **Discovery placements** at **$1.99** (~1,000 verified exposures each) + credit allocation for rotation | **Clarified** |
| No **ProNetworx** | Full Pro-Networx shell: profiles, feed, services, directory, messaging (subscription) | **Added** |
| No **The Refinery** / **The Yield** | Both shipped on mobile | **Added** |
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
| Support email | `support@networxradio.com` |
| Category | Music & Audio (primary), Entertainment (secondary) |
| Price | Free |
| Contains ads | No. The app does not show ads and the Android manifest removes `AD_ID`. |
| In-app purchases | Yes — discovery placements, credit packs, Pro Radio, and Pro-Networx (Google Play Billing). Song sales on Android use Play Billing, not a browser checkout. |

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

Networx Radio is the live democratic radio platform built for the next generation of music. Everyone hears the same always-on stream at the same time — no lonely algorithms, no gatekeepers. Discover hidden gems, send Ripples, vote fire or pass on what is playing, and help decide what rises on the leaderboards.

Whether you are a Prospector tuning in or a Gem ready to be heard, Networx turns passive listening into an interactive music community. One account also unlocks ProNetworx — the professional networking hub for creatives.

KEY FEATURES

• Always-On Democratic Radio — Tune into the shared Networx stream. Real-time synchronized playback so the whole community discovers together.

• Fire or Pass Voting — React to tracks with a fire vote (if it hits) or a pass (if it does not). Your vote shapes temperature scores and competition rankings.

• Temperature Scoring (0–100) — Every song gets a live temperature score. The hotter the track, the higher it ranks.

• Ripples — Send Ripples (likes) on artist profiles and saved songs. Every Ripple carries an artist a little further.

• Weekly Leaderboards & Competition — Climb ranks by Ripples, listens, positive votes, fire/pass ratio, saves, and Trial by Fire. Spotlight and Top 7 surfaces highlight breakout tracks.

• Trending Discovery — Explore what is heating up: underground hits, new genres, and gems before they go mainstream.

• Live Chat — Join the conversation while the music plays. Chat with artists and fellow Prospectors during radio and live sessions.

• Artist Livestreams — Approved artists and DJs can go live with real-time chat. Watch performances and connect face-to-face with creators.

• The Wake (Artist Analytics) — Track plays, votes, Ripples, temperature, engagement, and campaign results in one dashboard.

• Discovery Placements — Artists can purchase verified-exposure placements ($1.99 each, targeting ~1,000 listener exposures) to seed tracks into the discovery pipeline. Tracked delivery — not vanity numbers.

• Direct-to-Fan Song Sales — Free 30-second previews; fans purchase full tracks for complete playback and downloads.

• The Refinery — Prospectors refine songs through surveys, rankings, and feedback. Artists submit tracks for structured community review.

• The Yield — Prospectors earn rewards from verified engagement (refinement, surveys, feedback). Redeem balance for real rewards.

• ProNetworx — LinkedIn-style profiles, Instagram-style feed, services marketplace, directory, and messaging for every kind of creative (designers, photographers, producers, mentors, and more). One login for Networx Radio and ProNetworx.

• Push Notifications — Get alerted when your track is up next, when you go live, when artists you follow broadcast, and for account activity.

• Sign In Your Way — Continue with Google, Apple, or email. No Spotify login required.

FOR GEMS (ARTISTS)

Upload original music, promote with discovery placements, track The Wake analytics, go live to your fans, sell full tracks direct, and compete on leaderboards. Add songs to The Refinery for structured feedback. Connect with Catalysts on ProNetworx for production, visuals, and mentorship.

FOR PROSPECTORS (LISTENERS)

Listening is free — always. Stop letting algorithms decide your playlist. Vote fire or pass in real time, send Ripples, chat live, follow favorites, earn through The Yield, and crown the next breakout gem on the leaderboard.

COMMUNITY & COMPETITION

Music is better when it is shared. Networx is built around real-time community interaction and friendly competition. The temperature system makes every vote visible and every broadcast an event.

JOIN THE MOVEMENT

Download Networx Radio and feel the Butterfly Effect — where one connection can change everything.

Networx Radio is free to download and use. There are no ads. Artist discovery placements, credit packs, Pro Radio, and the ProNetworx subscription are in-app purchases. Prices are shown in the app. ProNetworx unlocks messaging and contact info.
```

**Approx. character count:** ~3,200 (within 4,000 limit)

---

## What's New — Initial release (500 characters max)

```
Version 1.0.87

• Report or block from a profile, post, chat, or live room
• Now playing on your home screen, and stations in Android Auto
• Song and station links open in the app
• Join an artist email list from their page
• Song-sale payouts after the artist finishes payout setup
• Terms at sign-up, password reset, and account deletion in Settings
• Subscription terms, privacy links, and restore purchases
```

**Character count:** 410

---

## Keywords / Tags (ASO)

```
networx, networx radio, indie music, independent artists, live radio, music streaming, discover new music, underground music, emerging artists, music app, radio app, music discovery, artist platform, music community, vote music, music charts, indie radio, unsigned artists, music competition, listener voting, live music, streaming app, temperature score, music leaderboard, chat music, free music app, music analytics, radio streaming, pronetworx, creative network, the refinery, the yield, butterfly effect, ripples, prospectors, gems, catalysts
```

**Total:** 30 keywords

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

- User-generated content (uploads, livestreams, chat)
- Social features including public chat
- Voting terminology includes mild slang (fire / pass reactions)
- In-app purchases (discovery placements, credits)
- Music may include explicit content; explicit labeling supported in product
- Not directed at children

---

## Character count summary

| Field | Limit | Used | Status |
|-------|-------|------|--------|
| App Title | 30 | 29 | OK |
| Short Description | 80 | 76 | OK |
| Full Description | 4000 | ~3200 | OK |
| What's New | 500 | 410 | OK |

---

## Pre-submit checklist

- [ ] Paste copy from this file into Play Console → Main store listing
- [x] `android:label` is **Networx Radio** (`mobile/android/app/src/main/AndroidManifest.xml`)
- [x] Package is `com.tmaktechnologies.networxradio`
- [x] Privacy, terms, legal, and child-safety pages returned HTTP 200 on `www.networxradio.com` (2026-11-01). In-app links open `https://pro-networx.com/privacy` and `https://pro-networx.com/terms`, which redirect to `www.pro-networx.com` and also return 200.
- [ ] Upload screenshots that show **Networx** branding (not RADIOapp). Draft frames are in `store-assets/`; recapture from a device before upload.
- [ ] Feature graphic uses the official NETWORX butterfly wordmark (`store-assets/play-feature-graphic.jpg`)
- [ ] Data Safety: no ads, advertising ID not collected, account deletion is inside Settings. Details in `docs/google-play-app-content-packet.md`.
- [ ] Play Billing product IDs match `GOOGLE_PLAY_PRODUCT_CATALOG_JSON` and mobile env
- [x] Listing copy does not mention Spotify login or “RADIOapp”
