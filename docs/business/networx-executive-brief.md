# NetworX — Executive Brief

**Product:** NetworX (NETWORX Radio: The Butterfly Effect) and Pro-Networx  
**Tagline:** By artists, for artists.  
**Status (Nov 2026):** Active development; mobile **1.0.99 (133)** on iOS and Android  
**Bundle / package:** `com.tmaktechnologies.networxradio` (iOS and Android)

---

## What NetworX is

NetworX is a full-stack **live radio platform** and **creator network** for independent artists. The core radio is a synchronized stream per station: everyone tuned in hears the same song at the same moment, with no skip. Artists upload songs, buy **discovery placements** per song, and get real-time feedback from fire/poop votes, ratings, comments, and analytics. **Prospectors** (listeners) discover music through the stream, Discover swipe clips, The Chat Room, song stories, and The Refinery. **Pro-Radio** adds on-demand full songs and personal playlists for subscribers. **Pro-Networx** is the professional network for creatives: profiles, portfolios, services, studios, a job board, and DMs, on its own domain (`pro-networx.com`) inside the same web app.

---

## Who we serve

| Audience | Value |
|----------|-------|
| **Artists** (and Producers, Instrumentalists, DJs) | Uploads, albums, discovery placements, song sales, analytics, livestreams, Refinery submissions, Pro-Networx profile. One account can hold several maker roles. |
| **Prospectors** | Live radio, Discover, The Chat Room, song comments and stories, Top 7 voting, Refinery reviews, Yield rewards |
| **Catalysts** | Service providers listed in the Pro-Networx directory, services, and studios |
| **Admins** | Song moderation and copyright scan, queue and rotation, streamer approval, reports, flagged accounts, payouts |

---

## Business model (implemented in code)

Prices come from `backend/src/payments`, the subscription constants, and `iap-product-catalog.ts`. Web pays through Stripe. The iOS and Android apps sell every digital good through App Store and Google Play billing.

| Revenue line | Price |
|--------------|-------|
| **Discovery placements** (per song, ~100 target exposures each) | 1 for $1.99; packs of 3 / 5 / 10 / 25 / 50 / 100 for $4.99 / $9.99 / $17.99 / $39.99 / $75.99 / $150. Packs add 1 / 2 / 4 / 10 / 20 / 40 free placements. New creators get 10 welcome placements. |
| **Pro-Radio** subscription | $4.99/mo ($1.99 first month on web) |
| **Pro-Networx** subscription | $9.99/mo ($4.99 first month on web) |
| **Pro Bundle** (Pro-Radio + Pro-Networx) | $12.99/mo |
| **Song and beat sales** | Artist sets the price on a fixed ladder: $0.99, $1.99, $2.99, $4.99, $9.99, $19.99, $29.99, $49.99. Artist balances pay out through Stripe Connect. |
| **Refinery submission** | $4.99 per song (in-depth review, default floor of 100 reviews) |
| **Livestream tips** | $1.99, $4.99, $9.99, or $24.99 |

**Beta switches (env):** `BETA_ALL_FREE` unlocks subscription features and free Refinery submissions; it defaults to off (paid). `PRO_NETWORX_MESSAGING_BETA_FREE` keeps Pro-Networx DMs free and defaults to on. Resumes and contact info stay subscription-gated.

**No audio ads** on the live radio stream. Prospector **Yield** pays out from verified engagement ($0.10 per Refinery review) and redeems at $5, $10, or $25.

---

## Current status (Nov 2026)

### What ships today

| Surface | What it includes |
|---------|------------------|
| **Web** (`networxradio.com`) | Marketing and legal pages, Radio, Pro-Radio, The Chat Room, DMs, Live DJ and Live Performances, Studios, Feed, Discover, Vote (competition), The Refinery, My Songs, Rewards, Settings, admin. Guests can browse and sign in when they act. |
| **Web** (`pro-networx.com`) | Pro-Networx home (Discover Creatives), directory, feed, services, studios, beats, jobs, search, profiles with each artist's radio catalog, shareable public profiles |
| **iOS** (15.0+) | Same feature set as web in a left navigation drawer, iPhone Now Playing widget, lock-screen and Dynamic Island controls with mute and fire/poop votes, Universal Links |
| **Android** | Same feature set as iOS, Android Auto station list, Android App Links |
| **Backend** (NestJS 11 on Railway) | Radio state shared through Redis with database fallback, BullMQ push queue, Supabase Postgres and storage, Firebase Auth |

### Shipped since July 2026

- **Store billing on mobile** for subscriptions, placements, song sales, tips, and Refinery submissions.
- **Pro-Radio** and the **Pro Bundle**, with playlists and an add-to-playlist button across the app.
- **Radio reliability:** server-driven rotation, station-switch fixes, Redis station lock, idle stations stop charging placements.
- **Radio player:** fire/poop votes with album effects, popular and peer scores, 1–10 rating, report reasons, per-song Comments next to Live Chat, song clips and stories with artist-credit stickers.
- **Discover:** swipe clips, selfie video recording, artist search with sort and scope.
- **Pro-Networx and Studios:** studio listings with map and rate cards, job board, Instagram-style message requests, profile sharing.
- **Accounts and safety:** guest browsing, unique display names, unique phone number with text-code sign-in (enforced once Twilio is configured), 48-hour account deletion grace, report and block, ACRCloud copyright matching, flood flagging for admin review.
- **Artist tools:** albums, artist email list on the artist page, analytics with Listens and Ears Reached, Stripe Connect payouts for song sales.

---

## Top risks

| Risk | Mitigation |
|------|------------|
| Sync drift on weak networks | Server-driven rotation, Redis station lock, identity-guarded track advances |
| Store prices drifting from code | Store consoles must match `iap-product-catalog.ts`; web and mobile read the same pack table |
| Beta switches left in the wrong state | `BETA_ALL_FREE` defaults to paid; confirm Railway env before each release |
| Yield cost outrunning paid Refinery submissions | Invite-only Refinery with seat caps (planned, below) |
| App Store / Play review policy | Store IAP for all digital goods, report/block, privacy manifest, account deletion |

---

## Next milestones

1. Turn on phone verification in production once Twilio is configured.
2. Keep App Store and Play console prices in sync with the placement pack table.
3. Decide when to flip `PRO_NETWORX_MESSAGING_BETA_FREE` off and restore the paid DM gate.
4. **Badge catalog** — permanent beta badge, profile trophy case, name chip beside the display name on comments. See [`badges-and-refinery-access.md`](badges-and-refinery-access.md). Not built yet.
5. **Invite-only Refinery** — raffle or referral, seats in batches so Yield stays payable. First campaign recruits 100 respected reviewers as the floor for a paid submission. Today the Refinery still accepts any signed-in reviewer.

---

## Links

- **Repo:** [RADIOapp on GitHub](https://github.com/Tmaku18/RADIOapp) (local path: this monorepo)
- **Notion OS:** See [`docs/notion/networx-workspace.md`](../notion/networx-workspace.md)
- **Archive (legacy RadioApp Notion):** [`docs/notion/notion-workspace-created.md`](../notion/notion-workspace-created.md)
