# NetworX — Business Decision Log

Structured ADR-style record. Each entry: **Context → Decision → Rationale → Impact**.

| # | Decision | Domain | Date | Status |
|---|----------|--------|------|--------|
| 1 | True radio, not on-demand skip | Product | 2025 | Accepted |
| 2 | Hard live sync (no mid-song hold) | Tech | 2026-06-24 | Accepted |
| 3 | Pro-Networx subscription gates networking | Monetization | 2026-06 | Accepted |
| 4 | Resume UX: always show, subscribe when locked | Product | 2026-06-24 | Accepted |
| 5 | Message UX: same as resume | Product | 2026-06-24 | Accepted |
| 6 | Private resumes bucket + signed URLs | Tech | 2026-06-24 | Accepted |
| 7 | Mobile 3D hero via WebView embed | Tech | 2026-06-24 | Accepted |
| 8 | Album art 2D, not three_js on mobile | Tech | 2026-06-24 | Accepted |
| 9 | Visualizer: web FFT, mobile simulated | Tech | 2026-06 | Accepted |
| 10 | No audio ads on live radio | Product | 2025 | Accepted |
| 11 | Monetization: credits + Pro-Networx sub | Monetization | 2025 | Accepted |
| 12 | Android package `com.discovermeradio.networxradio` | Infra | 2026-03 | Accepted |
| 13 | Discovery placement targets ~100 exposures | Monetization | 2026-11-19 | Accepted |
| 14 | Placement pack bonuses | Monetization | 2026-11-19 | Accepted |
| 15 | Badge catalog, permanent beta badge | Product | 2026-11-20 | Accepted |
| 16 | Invite-only Refinery, raffle or referral | Product | 2026-11-20 | Accepted |
| 17 | Bundle and package id `com.tmaktechnologies.networxradio` | Infra | by 2026-07-18 | Accepted |
| 18 | Role labels Artist and Producer in place of Gem and Catalyst | Product | 2026-07-22 | Accepted |
| 19 | Mobile digital goods through App Store and Google Play billing | Monetization | 2026-07-23 | Accepted |
| 20 | Song and beat prices on a fixed tier ladder | Monetization | 2026-07-31 | Accepted |
| 21 | Pro-Radio and Pro Bundle subscriptions | Monetization | 2026-08-06 | Accepted |
| 22 | Beta access switches for subscriptions and DMs | Monetization | 2026-08-06 | Accepted |
| 23 | Placements bought per song; credit bank removed | Monetization | 2026-08-18 | Accepted |
| 24 | Mobile API calls go to Railway first | Tech | 2026-08-29 | Accepted |
| 25 | Radio state shared through Redis; pushes queued | Tech | 2026-11-01 | Accepted |
| 26 | Popular and peer scores; several maker roles per account | Product | 2026-11-23 | Accepted |
| 27 | Idle stations do not charge placements | Monetization | 2026-11-23 | Accepted |
| 28 | Guest browsing, sign in on action | Product | 2026-11-23 | Accepted |
| 29 | Account identity: unique phone, text code, unique names, 48-hour deletion grace | Security | 2026-11-23 | Accepted |

---

## 1. True radio, not on-demand skip

**Context:** Users expect Spotify-style skip; product is positioned as live radio.  
**Decision:** Core radio has no user skip; synchronized stream across clients.  
**Rationale:** Differentiation, fairness in rotation, shared “LIVE” moment.  
**Impact:** Web/mobile player UX, backend queue authority, marketing copy.

---

## 2. Hard live sync (Jun 2026)

**Context:** Devices could play different songs mid-track when “DVR hold” kept local playback.  
**Decision:** `isServerAheadMidSong` always false; playing clients always follow server current song.  
**Rationale:** “3 songs on one station” bug broke trust in true radio.  
**Impact:** [`web/src/lib/radio-sync.ts`](../../web/src/lib/radio-sync.ts), [`mobile/lib/core/radio/radio_sync.dart`](../../mobile/lib/core/radio/radio_sync.dart).

---

## 3. Pro-Networx subscription gates networking

**Context:** Resumes and DMs expose contact info; open access increases spam risk.  
**Decision:** Active Pro-Networx subscription (or admin) required for resume PDF and messaging access.  
**Rationale:** Monetize networking; protect member contact data.  
**Impact:** `pro-networx.service.ts`, profile APIs, web + mobile paywalls.

---

## 4. Resume UX: always show, subscribe when locked

**Context:** Hiding Resume button confused users (“feature missing”).  
**Decision:** Always show Resume; `resumeLocked: true` → subscribe flow on click.  
**Rationale:** Conversion funnel clarity; consistent with freemium pattern.  
**Impact:** Web profile, mobile `ProProfileScreen`, checkout / `ProNetworkPaywallSheet`.

---

## 5. Message UX: same as resume

**Context:** Messaging was follow-to-DM or hidden for non-subscribers.  
**Decision:** Always show Message; `messagingLocked` → subscribe on click.  
**Rationale:** Parity with resume; single subscription value prop.  
**Impact:** Web messages page, mobile messages thread.

---

## 6. Private resumes bucket + signed URLs

**Context:** `users.resume_url` stored private Supabase path; raw path 404 on open.  
**Decision:** API signs path via `UploadsService.getResumeSignedUrl()` before return.  
**Rationale:** Security + working links for authorized viewers only.  
**Impact:** Pro-Networx profile endpoint, Supabase `resumes` bucket.

---

## 7. Mobile 3D hero via WebView embed

**Context:** Native `flutter_angle` / GLES failed on physical Android devices.  
**Decision:** WebView loads web `/embed/butterfly` for Dimension hero.  
**Rationale:** Parity with web Three.js scene without device GL fragility.  
**Impact:** Mobile Dimension home, web embed route.

---

## 8. Album art 2D on mobile player

**Context:** `three_js` cube failed GL init on devices; covers invisible.  
**Decision:** `Image.network` with gentle animation in `FloatingAlbumScene`.  
**Rationale:** Reliability over 3D on player bar.  
**Impact:** [`mobile/lib/features/dimension/floating_album_scene.dart`](../../mobile/lib/features/dimension/floating_album_scene.dart).

---

## 9. Visualizer strategy

**Context:** Real mic FFT breaks background playback; mobile mic permission heavy.  
**Decision:** Web uses dramatized FFT where safe; mobile uses organic simulated motion.  
**Rationale:** Visual delight without breaking radio or permissions.  
**Impact:** Web player visualizer, mobile dimension player.

---

## 10. No audio ads on live radio

**Context:** Sponsorship revenue vs listener experience.  
**Decision:** Visual sponsorship only on radio surfaces; no interrupting audio ads in stream.  
**Rationale:** Preserve “radio” feel; artist-first brand.  
**Impact:** Product policy, Venue Partner slot design.

---

## 11. Monetization stack

**Context:** Need sustainable revenue beyond credits.  
**Decision:** Artist credits for rotation + Pro-Networx subscription for networking.  
**Rationale:** Align payment with value (airtime vs professional access).  
**Impact:** Stripe products, webhook handlers, paywall UI.

---

## 12. Android package identity

**Context:** Play Console uniqueness and branding.  
**Decision:** Package `com.discovermeradio.networxradio`.  
**Rationale:** NetworX brand on store listing; separate from legacy IDs.  
**Impact:** `mobile/android`, Firebase `google-services.json`, release pipeline.

---

## 13. Discovery placement exposure

**Context:** Buy placements priced each $1.99 placement at a target of about 1,000 verified listener exposures.  
**Decision:** One placement still costs $1.99 and still buys one placement. The exposure it adds to the song is 100, one tenth of the previous target. Welcome placements use the same 100.  
**Rationale:** The delivery promise on the buy screen and in pricing was too high for the price.  
**Impact:** `EXPOSURES_PER_PLACEMENT`, Buy placements on web and mobile, pricing page, FAQ, features, Play listing, and the finance briefing.

---

## 14. Placement pack bonuses

**Context:** Artists buy placements in packs of 1, 3, 5, 10, 25, 50, or 100.  
**Decision:** One placement is $1.99. Pack prices are $4.99 for 3, $9.99 for 5, $17.99 for 10, $39.99 for 25, $75.99 for 50, and $150 for 100. Extra placements are added when the purchase is applied: 3 gets 1 free, 5 gets 2, 10 gets 4, 25 gets 10, 50 gets 20, and 100 gets 40. One placement has no bonus.  
**Rationale:** Larger packs should deliver more than the paid count.  
**Impact:** `bonusPlacementsFor` and `packPriceCents` in payments. Web checkout and the mobile store catalog both use that table, so the list price is the same. Store consoles still have to be set to these amounts or Apple and Google charge the old price.

**Income planning (Nov 2026):** subscriptions stay on the previous model (2% Pro Bundle, 2% Pro-Networx, 1.5% Pro-Radio, 25% blended store cut). Discovery changes to 2% of monthly active users buying one pack. The mix averages $8.38 before the store cut. At 10,000 monthly active users that is about $5,860 net per month, about $70,320 per year, before hosting, payroll, refunds, and tax.

---

## 15. Badge catalog and permanent beta badge

**Context:** The product has no trophy people can earn and show. Beta members need a lasting mark, and later badges need different earn rules and optional perks.  
**Decision:** Badges live in a catalog. Each badge is cosmetic, carries a perk, or both. Perks are defined when that badge is created. Every account created while beta is open receives one badge, once, and keeps it after beta ends. The full set shows in a profile trophy case (earned date and meaning). A name chip sits next to the display name on Refinery comments, then on chat and other comment surfaces using the same treatment. When someone holds several badges, the name chip shows the primary one.  
**Rationale:** Badges are trophies. A catalog lets new badges ship over time without a new display system. The beta badge rewards people who joined early without making it expire.  
**Impact:** Strategy in [`badges-and-refinery-access.md`](badges-and-refinery-access.md). Planned tables `badge_definitions` and `user_badges`. Profile, Refinery comments, and later comment surfaces. Not built yet.

---

## 16. Invite-only Refinery

**Context:** The Refinery pays Yield for verified review work. Open signup would admit more reviewers than artist submissions can fund. Artists who pay are owed a real review, and that review should come from people they respect.  
**Decision:** The Refinery is invite-only. Open “sign up and review” is retired. Two ways in: enter the raffle, or be referred by someone already inside. Both still pass a capacity check. Seats open in batches. A paid Refinery submission is staffed toward a floor of at least 100 reviewers. The first campaign recruits those 100 from people artists already respect (producers, respected listeners, scene voices). They are the founding review bench. Later reviewers still enter by raffle or referral. The merch **Founding 100** cohort is a different thing and stays named as it is.  
**Rationale:** Capacity is how Yield stays payable. The first 100 are how the paid-review promise is staffed before the room grows. Scarcity is the public hook; credibility is who gets the first seats.  
**Impact:** Strategy in [`badges-and-refinery-access.md`](badges-and-refinery-access.md). Planned `refinery_membership` with source `raffle`, `referral`, or `founding_reviewer`. Public copy stays truth-safe: Yield for verified Refinery work, seats limited. No “get paid to listen” as a shipped slogan. Not built yet.

---

## 17. Bundle and package identity

**Context:** Entry 12 recorded `com.discovermeradio.networxradio`. The code imported on 2026-07-18 already used a TMAK Technologies identifier.  
**Decision:** iOS bundle id and Android `applicationId` are `com.tmaktechnologies.networxradio`. The iOS Now Playing widget uses `com.tmaktechnologies.networxradio.NowPlayingWidget`. Supersedes entry 12.  
**Rationale:** One identifier across both stores, owned by the publishing company.  
**Impact:** `mobile/android/app/build.gradle.kts`, `mobile/ios/Runner.xcodeproj`, Firebase config, App Links and Universal Links.

---

## 18. Role labels: Artist and Producer

**Context:** Signup and Settings showed Gem and Catalyst as role names.  
**Decision:** Role labels read Listener, Artist, Producer, Instrumentalist, and DJ. Database values stay `listener`, `artist`, `service_provider`, `musician`, and `dj`. Catalyst stays in Pro-Networx marketing copy for service providers.  
**Rationale:** Plain labels at the point where people pick what they do.  
**Impact:** `web/src/lib/roles.ts`, `mobile/lib/core/auth/role_helpers.dart`, signup, admin users, glossary (`a903dec0`).

---

## 19. Mobile digital goods through store billing

**Context:** Apple allows external purchase links only on the US storefront, and Google Play requires enrollment in its external links program. The app ships worldwide.  
**Decision:** On iOS and Android every digital good uses App Store or Google Play billing: subscriptions, discovery placements, song and beat purchases, livestream tips, and Refinery submissions. Stripe stays web-only for these goods, and the backend rejects Stripe calls tagged `ios` or `android`.  
**Rationale:** Store policy compliance without a US-only build.  
**Impact:** `store-billing-policy.ts`, `iap-product-catalog.ts`, `app-store-billing.service.ts`, `google-play-billing.service.ts`, mobile paywalls (`b8079faa`, `126821ec`). Store console prices must match the catalog.

---

## 20. Song and beat price ladder

**Context:** Stores can only sell pre-registered products at fixed prices, and artists set their own prices.  
**Decision:** Artist prices snap to $0.99, $1.99, $2.99, $4.99, $9.99, $19.99, $29.99, or $49.99. Each tier is one consumable store product reused across songs. Defaults are $0.99 for a song and $9.99 for a beat. Ownership lives in `song_purchases`.  
**Rationale:** One SKU per price tier keeps the store catalog small and lets a buyer purchase many songs at the same price.  
**Impact:** `song-price-tiers.ts` and the mobile mirror, upload and edit price pickers.

---

## 21. Pro-Radio and Pro Bundle

**Context:** The live radio has no skip. Listeners asked for on-demand listening and playlists.  
**Decision:** Pro-Radio adds on-demand full songs, personal playlists, and a controllable player for $4.99/mo ($1.99 first month on web). Pro Bundle combines Pro-Radio and Pro-Networx for $12.99/mo, against $14.98 for both alone. The free live radio stays synchronized with no skip.  
**Rationale:** Monetize on-demand listening without changing the shared radio moment (entry 1).  
**Impact:** `pro-radio-subscription`, `pro-bundle-subscription`, `/pro-radio` on web, mobile Pro-Radio hub (`1d1e1f06`).

---

## 22. Beta access switches

**Context:** Testers needed to use paid features while pricing stayed visible.  
**Decision:** `PRO_NETWORX_MESSAGING_BETA_FREE` keeps Pro-Networx DMs and job applications free and defaults to on; resumes and contact info stay gated. `BETA_ALL_FREE` unlocks Pro-Radio, Pro-Networx, Creator Network, and free Refinery submissions. Song sales and paid placements stay paid, and the 10 welcome placements stay locked until the switch is off. Since 2026-11-01 it defaults to off (paid).  
**Rationale:** Free testing without distorting artist revenue or rotation thresholds.  
**Impact:** `common/beta-access.ts`, `pro-network-subscription.constants.ts`, Railway env (`42e0f941`, `a92a50d6`, `fce2dc3e`).

---

## 23. Placements bought per song

**Context:** Artists bought a credit bank and then allocated plays to songs in a second step.  
**Decision:** The credit bank and Allocate screens are removed. Artists buy discovery placements for a specific song, and the 10 signup welcome placements can be split across songs. Updates entry 11.  
**Rationale:** One step from “promote this song” to a paid placement.  
**Impact:** Buy placements on web and mobile, `credits.service.ts`, `welcome-placements.ts` (`4574955f`, `e43f9579`).

---

## 24. Mobile API calls go to Railway first

**Context:** The app reached the backend through the web host. When that host was disabled, the app went down with it.  
**Decision:** Mobile calls the Railway backend first and fails over to the next host on a 402. 502, 503, and 504 retry only on GET so a write is never applied twice.  
**Rationale:** The app should not depend on the website being up.  
**Impact:** Mobile API client (`e364f665`).

---

## 25. Radio state shared through Redis

**Context:** Current-track state lived in one process, so a second backend replica would diverge.  
**Decision:** Station lock and last-good song live in Redis, with database fallback when Redis is down. Push notifications go through a BullMQ queue and send immediately when Redis is unavailable.  
**Rationale:** Safe horizontal scaling and steadier rotation.  
**Impact:** `radio-state.service.ts`, `push-queue.service.ts`, Railway Redis (`ccef9477`, `0bab9ad8`).

---

## 26. Popular and peer scores; several maker roles

**Context:** One temperature mixed listener votes with votes from other creators, and each account held a single role.  
**Decision:** Votes from listeners form the popular score; votes from makers (Artist, Producer, Instrumentalist, DJ) form the peer score. Listener 1–10 ratings are stored separately from temperature votes. One account can hold several maker roles. Votes with no listen and burst spam are left out of both scores, and the account is flagged for admin review without a ban.  
**Rationale:** Artists learn whether fans and peers agree. Spam does not move scores, and real people are not banned by a heuristic.  
**Impact:** `common/vote-integrity.ts`, migration `145_user_roles_vote_cohorts.sql`, player chrome, admin users (`618aae6a`, `1875f2ac`, `126597c3`).

---

## 27. Idle stations do not charge placements

**Context:** Stations advanced and spent placement budget even with nobody listening.  
**Decision:** Idle stations still advance but skip plays, decision logs, temperature refresh, and placement charges until someone is listening.  
**Rationale:** Artists pay for exposures, and an empty station delivers none.  
**Impact:** Radio rotation and charging (`8652e107`).

---

## 28. Guest browsing

**Context:** Signed-out visitors met sign-in before they could look around the app.  
**Decision:** Continue as guest opens the same home on web and mobile. Likes, follows, saves, messages, comments, and votes ask the guest to sign in. Public read APIs stay available.  
**Rationale:** Let people hear the product first.  
**Impact:** Web and mobile auth gating, public endpoints (`6f95638c`, `f312728c`).

---

## 29. Account identity and deletion

**Context:** Accounts could share display names and phone numbers, and a deleted account had no undo window.  
**Decision:** Each account claims one unique mobile number and confirms a text code on sign-in; production enforces this once Twilio is configured. Display names and usernames are unique, including spacing, punctuation, or a trailing-number variant. Deleting an account schedules removal after 48 hours, and signing in again within that window restores it.  
**Rationale:** One person, one identity, with a safe undo for deletion.  
**Impact:** Migration `146_phone_mfa.sql`, `149_unique_display_names.sql`, sign-in flows, Help and profile deletion (`22c651ed`, `4133958e`, `cbb88f31`).
