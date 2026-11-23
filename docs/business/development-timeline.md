# NetworX — Development Timeline

Themed milestones from git history (Jan–Nov 2026). For commit-level detail run:

```bash
git log --format="%ad|%s" --date=short
```

---

## Q1 2026 — Pro-Networx and Dimension

| Period | Themes |
|--------|--------|
| **Jan–Feb** | Pro-Networx 3D directory, analytics “ears reached”, Google Sign-In fixes |
| **Mar** | Streamer approval, Discover tabs, bottom nav, Live discovery, Android package rebrand |

**Representative work:** Pro-Networx landing and directory, report/block feed, admin streamer approval, competition leaderboards, temperature model.

---

## Q2 2026 — Radio reliability and parity

| Period | Themes |
|--------|--------|
| **Apr–May** | Radio sync parity, background audio, crossfade removal, FFT visualizer |
| **Jun** | Hard device sync, WebView 3D hero, album covers 2D, Pro-Networx resume/message gates, v1.0.12 |

---

## June 2026 detail (by week)

### Week of 2026-06-20

- Pro-Networx 3D directory as post-sign-in landing
- Report posts/users, block users, admin reports
- Pro-Networx radio player layout parity with Networx listen
- Google Sign-In Play Store fixes (build 12–14)
- Analytics: ears reached on dashboard; marketing stats API

### Week of 2026-06-21

- Mobile Dimension: typography, 3D hero, Top 7 voting, glass UI
- Guest radio, presence, analytics copy parity
- Live listener count fix (heartbeat RPC)
- Listens vs Ears Reached unified definition
- Remove skip controls from live radio

### Week of 2026-06-22

- Radio parity: web repeats/queue sync, mobile listen UX
- DJ Mixes station (`us-dj-mixes`)
- FFT visualizer fixes (crossOrigin, zero-signal recovery)
- Background radio on mobile web and app
- Mobile builds 1.0.1 (17) → 1.0.2 (18)
- Pro directory regression fixes, back-to-radio navigation

### Week of 2026-06-23

- 3D hero blank fixes on physical Android (iterations v1.0.4–1.0.8)
- Sign-out stuck loading fix
- Dimension hero diagnostics

### Week of 2026-06-24

- **Hard live sync** — web + mobile (v1.0.10 build 26)
- **WebView 3D hero** on physical devices
- **Album cover 2D** (v1.0.11 build 27)
- **Visualizer** dramatization and organic mobile motion
- **Pro-Networx resume** signed URL + subscription gate
- **Pro-Networx messaging** subscribe-on-click (v1.0.12 build 28)

---

## Mobile release line (Jun 2026)

| Version | Build | Highlight |
|---------|-------|-----------|
| 1.0.9 | 25 | Prior release track |
| 1.0.10 | 26 | Hard live cross-device sync |
| 1.0.11 | 27 | Album cover loads on devices |
| 1.0.12 | 28 | Pro-Networx resume/messaging subscribe gates |

June closed at **`1.0.12+28`**. For the current version see the Jul–Nov release line below and [`mobile/pubspec.yaml`](../../mobile/pubspec.yaml).

---

## Key commit SHAs (Jun 2026)

| SHA | Subject |
|-----|---------|
| `eafec0a` | Radio hard live sync |
| `03d28ac` | WebView 3D hero parity |
| `d0a153b` | Album cover 2D |
| `a9c1230`–`0d44aea` | Pro-Networx resume/messaging gates |
| `23df865` | Bump 1.0.12+28 |

---

## Q3 2026 — Store billing, Pro-Radio, and Studios

A local import was merged with `origin/main` on 2026-07-19 (`b7a3f9a8`, `1f0781dd`). Both histories remain in `git log`.

| Period | Themes |
|--------|--------|
| **Late Jul** | iOS App Store and TestFlight pipeline, left navigation drawer, Discover video clips, store billing for every digital good on mobile, DJ Booth and Live Performances over WHIP/WHEP |
| **Aug** | Pro-Radio and Pro Bundle, beta access switches, radio rotation fixes, albums, copyright scanning, DM message requests, artwork-first mobile redesign, Studios, per-song placements, RLS on public tables |

### July 2026 (from 07-19)

- iOS App Store in-app purchases, privacy strings, export compliance, iOS 15 minimum
- Mobile visuals: Dimension backdrop and glass surfaces, then a left navigation drawer replacing the bottom tab bar
- Networx Home as the post-sign-in landing; Nearby People with city/ZIP pins; The Chat Room naming
- Discover: artist search, selfie video recording to liked clips, feed video uploads up to 5 minutes and 1 GB direct to storage
- Favorite artists with radio-only notifications; song favorites split from likes
- Mobile digital purchases routed through App Store and Play Billing (`b8079faa`); song and beat sales through store IAP on a fixed price ladder (`126821ec`)
- DJ Booth and livestream fixes: WHEP playback, mic talk-over, radio pauses while a stream plays
- Artist and Pro-Networx cover images with cropping

### August 2026

- Pro-Networx messaging free during beta while pricing stays promoted (`42e0f941`)
- Pro-Radio routing, playback, and web hub (`1d1e1f06`); playlists with an add-to-playlist button
- `BETA_ALL_FREE` master switch for subscription features (`a92a50d6`)
- Radio: server-driven rotation, station-switch sync, lossless uploads transcoded to MP3, Ready Now as the opening station
- Albums on artist pages; admin copyright flags and bulk ACRCloud scan
- Artists add songs to The Refinery; required review questions after a song is picked
- DMs with Instagram-style message requests; nav consolidation (Library into Pro-Networx, Upload into My Songs)
- Invite friends by text, email, or the share sheet
- Artwork-first mobile redesign with electric cyan kept as the accent (`fe9936be`, `82942a72`)
- Studios with map, rate cards, and photo uploads, folded into Pro-Networx Studios
- Credit bank and Allocate removed; artists buy placements per song (`4574955f`)
- Website brought to parity with mobile for Beats, The Chat Room, and the Discover library
- Welcome placements split per song (10 at signup); RLS enabled on client-exposed tables (`3c7dbac7`)
- Stripe webhook and App Store refund fixes; ACRCloud matches shown in-app
- Mobile API calls go to Railway first so a down web host cannot take the app offline (`e364f665`)

---

## Q4 2026 — Store launch prep and the radio player

| Period | Themes |
|--------|--------|
| **Nov 1** | Store launch prep, growth tools, Redis-shared radio state, BullMQ push queue, Android Auto, iPhone Now Playing widget, artist email list, Stripe Connect song-sale payouts |
| **Nov 10–20** | Player polish, song clips and stories, placement repricing, mobile typefaces, analytics accuracy, lock-screen votes |
| **Nov 23** | Guest browsing, phone verification, unique names, account deletion grace, per-song Comments, popular and peer scores, profile sharing |

### November 2026

- **Launch prep (`fce2dc3e`):** report and block, signup terms, paywall disclosures, privacy manifest, crash reporting
- Growth tools: engagement-ranked Discover, catalog search, referrals, weekly artist recap, quiet hours (`96220b87`)
- Radio state and station lock shared across servers through Redis; BullMQ queues pushes (`ccef9477`, `0bab9ad8`)
- Shared links open in the app; Android Auto lists stations; iPhone home and lock screen show the current song
- Listeners join an artist's email list from the artist page (`cbb66f5f`)
- Artists' waiting song-sale balance pays out once Stripe Connect can receive funds (`021b40d9`)
- Player: equalizer restored, mute state on the radio control, tilting album cover, free-scroll lyrics
- Song clips: record the song that is on, Instagram share, send in DMs, post as a public or private story, artist-credit stickers, hold-to-record camera with zoom
- Analytics: sort by plays, views, likes, name, recency; Ears Reached counts unique people
- Mobile typefaces switch to Satoshi, DM Sans, and Space Grotesk; the website keeps its fonts
- Discovery placements: target cut from 1,000 to 100 exposures, discounted pack prices, free placements on packs (`3dc961d5`, `aac6de6b`, `4f0fe65d`)
- Admin queue: queue a song next, drag to reorder, search before adding
- Lock screen and Dynamic Island: fire/poop votes and a mute control without opening the app
- Badge catalog and invite-only Refinery strategy recorded (`9c30e2e8`, docs only)
- Search as you type across radio, Pro-Networx, and admin
- Per-song Comments thread beside station Live Chat (`7468b5ff`)
- Radio scores split into popular and peer votes; one account can hold several maker roles (`618aae6a`)
- Flood flagging for comments and likes, listed for admin review
- Each artist's radio catalog on Pro-Networx; switching between Radio and Pro without a sign-in screen
- Idle stations stop charging placements and polling drops (`8652e107`)
- Guest browsing with sign-in on action (`6f95638c`)
- Unique mobile number with a text code on sign-in (`22c651ed`), 48-hour deletion grace (`cbb88f31`), unique display names and usernames (`4133958e`)
- Shareable artist and Pro profiles that open the installed app; Discover and Search artist results as glass cards

---

## Mobile release line (Jul–Nov 2026)

| Version | Build | Highlight |
|---------|-------|-----------|
| 1.0.16 | 39 | Left navigation drawer, notification deep links, push permission prompt |
| 1.0.23 | 46 | First Android store bump after the import |
| 1.0.37 | 62 | Store billing for digital purchases |
| 1.0.41 | 66 / 67 | DJ Booth and Live Performances on mobile |
| 1.0.55 | 82 | Upload reliability (direct-to-storage feed media) |
| 1.0.58 | 85 | Pro-Radio |
| 1.0.72 | 99 | DM message requests and nav consolidation |
| 1.0.75 | 103 | Artwork-first redesign |
| 1.0.79 | 107 | Per-song placements, Studios, Discover swipe actions |
| 1.0.85 | 113 | Copyright matches in-app |
| 1.0.87 | 115 | Railway-first API routing |
| 1.0.88 | 117 | Store launch prep, Now Playing widget, Android Auto |
| 1.0.91 | 120 | Song clips, stories, and the radio recorder |
| 1.0.97 | 126 | Slide-to-zoom camera, discounted placement packs, admin queue reorder |
| 1.0.98 | 127 | Lock-screen votes, new placement tiles, artist home stats, Refinery mutes the radio |
| 1.0.99 | 128–133 | Guest browsing, per-song Comments, Dynamic Island mute and votes, swipe-to-close player, lock-screen song updates |

Current: **`1.0.99+133`** in [`mobile/pubspec.yaml`](../../mobile/pubspec.yaml).
