# Mobile–Web Parity Matrix (Source of Truth)

**Product:** NETWORX Radio + Pro-Networx  
**Updated:** 2026-11-23  
**Purpose:** Single checklist for feature parity between the **Next.js web app** (`web/src/app/(dashboard)`, `web/src/app/(ProNetworx)`) and **Flutter** (`mobile/lib`), plus **Android vs iOS** behavior where it differs. The other parity docs ([docs/mobile/mobile-parity-matrix.md](mobile/mobile-parity-matrix.md), [mobile/docs/web_mobile_parity_matrix.md](../mobile/docs/web_mobile_parity_matrix.md), [mobile/docs/parity_acceptance_checklist.md](../mobile/docs/parity_acceptance_checklist.md)) follow this file.

## Status legend

| Status | Meaning |
|--------|---------|
| `done` | Equivalent capability shipped on that surface |
| `partial` | Works but with fewer options than the other surface (see Notes) |
| `missing` | Not available |
| `platform-divergent` | Same outcome, different implementation (e.g. Play Billing vs App Store vs Stripe) |
| `n/a` | Does not apply to that surface |

## Matrix

### Radio & player

| Feature area | Web | Mobile (Flutter) | Android | iOS | Notes |
|--------------|-----|------------------|---------|-----|--------|
| Live radio, stations, hard sync | done | done | done | done | Shared `/radio/*`; both reopen the last station |
| Heartbeat / play reporting | done | done | done | done | |
| Mute that persists across songs and stations | done | done | done | done | Radio also mutes while clips, feed videos, livestreams, or Refinery songs play |
| Fire / poop votes | done | done | done | done | Web mini player shows fire + poop and no share button |
| 1–10 rating, report reasons, more menu | done | done | done | done | |
| Popular vs peer scores | done | done | done | done | |
| Live Chat + per-song Comments | done | done | done | done | Chat field stays above the keyboard on mobile |
| Synced lyrics | done | done | done | done | |
| Song stories (view, visibility, delete, report) | done | done | done | done | Stories bar under the progress bar |
| Record a radio clip and post it | partial | done | done | done | Web radio player has no record button; web records clips from Pro-Radio. Mobile: hold-to-record camera, artist-credit sticker, text, pinch/slide zoom |
| Send clip in DMs / Instagram share | done | done | done | done | Web: `SendClipDialog`, `SocialShareButtons` |
| Drag to open player / swipe down to close | n/a | done | done | done | Gesture on the mobile radio bar and full player |
| Lock screen / system media controls | partial | done | platform-divergent | platform-divergent | Web: media session. Android: media notification + Android Auto station list. iOS: Now Playing widget + Live Activity with mute and fire/pass votes |
| Listening tools (sleep timer, recent listening) | missing | done | done | done | Mobile Settings → Listening |
| Venue ad slot | missing | done | done | done | `web/src/components/radio/VenueAdSlot.tsx` exists but is not mounted |
| Rising Star pulse | done | done | done | done | `station_events` Realtime |

### Discover, search & social

| Feature area | Web | Mobile (Flutter) | Android | iOS | Notes |
|--------------|-----|------------------|---------|-----|--------|
| Discover swipe | done | done | done | done | Web `/social/discover`; mobile Discover → Swipe |
| Discover artists (glass cards, Popular / Most songs / Recent) | done | done | done | done | Web `/discover` Artists tab; mobile Discover → Artists |
| Artist scope Everyone / Following / Liked | missing | done | done | done | Mobile Discover and Search; Everyone is the default |
| Search as you type with genre filter | partial | done | done | done | Web: search, sort, and genre filter on `/discover` Artists. Mobile: `/search` covers songs, artists, people |
| Discover library (liked, disliked, favorites, playlists) | done | done | done | done | Web `/social/discover/list`, `/browse/saved` |
| Create video to a liked clip | done | done | done | done | |
| Feed posts (photo, video, audio) | done | done | done | done | |
| The Chat Room | done | done | done | done | |
| DMs, message requests, reactions, media | done | done | done | done | |
| Notifications inbox | done | done | done | done | |
| Push notifications (FCM) | n/a | done | done | done | Mobile-only |
| Competition / leaderboards / Top 7 vote | done | done | done | done | |
| Song favorites (stars) | partial | done | done | done | Web lists and removes favorites; starring is mobile |
| Favorite artists (radio-only alerts) | missing | done | done | done | |
| Invite friends / referrals | missing | done | done | done | |
| Artist profile + share link | done | done | done | done | `/open/artists/:id`; guests can view; "Open in the NetworX app" |
| Fan email list | partial | done | done | done | Web: join from the artist page. Mobile also shows the artist's own list |
| Follow, block, report | done | done | done | done | |
| Guest browsing | done | done | done | done | Sign-in prompted on actions (vote, message, follow) |

### Artist & creator

| Feature area | Web | Mobile (Flutter) | Android | iOS | Notes |
|--------------|-----|------------------|---------|-----|--------|
| Song upload | done | done | done | done | |
| Albums | done | done | done | done | |
| My Songs (sort, share, copyright match notices) | done | done | done | done | |
| Buy placements | done | done | platform-divergent | platform-divergent | Web: Stripe Checkout. Android: Google Play. iOS: App Store |
| Welcome placements | done | done | done | done | Locked while `BETA_ALL_FREE` is on |
| Credit bank / allocate | n/a | n/a | — | — | Retired; web `/artist/songs/[id]/allocate` redirects to Buy placements |
| The Wake (analytics) | done | done | done | done | |
| Stripe Connect payouts | done | done | done | done | Web `/artist/payouts`; mobile My Songs |
| Live services + Support (Discord) | done | done | done | done | `POST /live-services/support` |
| Refinery: submit, review, analytics, comments | done | done | done | done | Submission fee: Stripe on web, store purchase on mobile |
| Yield / rewards | done | done | done | done | |

### Livestream

| Feature area | Web | Mobile (Flutter) | Android | iOS | Notes |
|--------------|-----|------------------|---------|-----|--------|
| Stream settings (apply / pending / approved) | done | done | done | done | |
| Go live (DJ or musician, WHIP) | done | done | done | done | Go live shows only on your own artist profile |
| Live DJ / Live Performances listings | done | done | done | done | |
| Watch live (WHEP) + stream chat | done | done | done | done | Radio pauses while watching |
| Stream donations | done | done | done | done | |
| Admin force-stop | done | done | done | done | |

### Pro-Radio & Pro-Networx

| Feature area | Web | Mobile (Flutter) | Android | iOS | Notes |
|--------------|-----|------------------|---------|-----|--------|
| Pro-Radio hub, player, playlists | done | done | done | done | |
| Pro-Radio clip recorder | done | done | done | done | |
| Pro-Networx / Pro-Radio / bundle subscriptions | done | done | platform-divergent | platform-divergent | Web: Stripe. Android: Google Play. iOS: App Store |
| Pro tabs: Home, Discover, Search, Beats, Services, Studios, Projects, Radio | done | done | done | done | Same eight tabs on web (`ProNetworxAppShell.tsx`) and mobile (`pro_networx_nav_drawer.dart`) |
| Studios directory + Nearby (list / map) | done | done | done | done | Also reachable from Radio nav → Studios |
| My Studio editor | done | done | done | done | |
| Pro profile, portfolio, resume, Follow, Message | done | done | done | done | |
| Pro profile share (Text / Send in a DM) | done | done | done | done | `/pro-networx/u/:id` loads for signed-out visitors |
| Pro onboarding form | done | missing | — | — | Mobile edits the same fields in My profile |
| Job board / Projects | done | done | done | done | |

### Account & settings

| Feature area | Web | Mobile (Flutter) | Android | iOS | Notes |
|--------------|-----|------------------|---------|-----|--------|
| Email, Google, Apple sign-in | done | done | done | done | |
| Phone MFA (text code every sign-in) | done | done | done | done | `PhoneMfaGate` on both |
| Profile edit + social links | done | done | done | done | |
| Theme, blocked accounts, notification prefs | done | done | done | done | |
| Account deletion (48-hour restore window) | done | done | done | done | |
| Session cookies (SSR) | done | n/a | — | — | Mobile uses bearer tokens |
| App Links / Universal Links | n/a | done | done | done | `networxradio://` custom scheme too |

### Admin

| Feature area | Web | Mobile (Flutter) | Android | iOS | Notes |
|--------------|-----|------------------|---------|-----|--------|
| Songs moderation (approve, reject, trim, metadata, stations, copyright filter) | done | done | done | done | |
| Queue (search, play next, reorder, skip) | done | done | done | done | Mobile reorders from the DJ Booth |
| DJ Booth | done | done | done | done | |
| Users (roles, bans, restore, delete) | done | done | done | done | Streamer-access toggle in Users is web-only |
| Swipe / feed moderation | done | partial | done | done | Mobile lists and deletes clips; playing and editing clip windows is web-only |
| Fallback / free rotation | done | done | done | done | |
| Streamer approvals | done | done | done | done | |
| Reports, lyrics, payouts, activity flags | done | missing | — | — | Web admin only |
| App release broadcast, TestFlight invite email | missing | done | done | done | Mobile Admin → Overview |

## Implementation references

- Web IA: [web/src/app/(dashboard)/layout.tsx](../web/src/app/(dashboard)/layout.tsx), [web/src/components/dimension/ProNetworxAppShell.tsx](../web/src/components/dimension/ProNetworxAppShell.tsx), [web/src/lib/api.ts](../web/src/lib/api.ts)
- Mobile routes: [mobile/lib/core/navigation/app_routes.dart](../mobile/lib/core/navigation/app_routes.dart), [mobile/lib/core/navigation/app_router.dart](../mobile/lib/core/navigation/app_router.dart)
- Mobile navigation: [mobile/lib/widgets/home_screen.dart](../mobile/lib/widgets/home_screen.dart) (bottom bar: Home, Radio, Feed, Discover, Vote or Pro), [mobile/lib/widgets/dimension/dimension_nav_drawer.dart](../mobile/lib/widgets/dimension/dimension_nav_drawer.dart)
- Feature narrative: [features-summary.md](./features-summary.md), [system-diagram.md](./system-diagram.md)

## Acceptance checks (parity smoke)

1. **Listener:** Radio → vote fire/poop → rate 1–10 → Comments → song stories → Discover (Swipe, Artists, Library) → Vote → Refinery → Rewards; DMs from the drawer.
2. **Artist / Catalyst:** My Songs (upload, Buy placements, share, Refinery submit, payouts) → Analytics → Live services → Pro-Networx (profile, services, studio).
3. **Support tab:** Submit requires a Discord URL (`discord.com` or `discord.gg`); backend emails `SUPPORT_EMAIL` or fallback.
4. **Payments:** Web completes Stripe Checkout; Android completes a Google Play purchase; iOS completes an App Store purchase for the same placement pack.
5. **Push tap:** Routes to player, analytics, watch live, DM thread or requests, notifications, or artist profile per [mobile/lib/main.dart](../mobile/lib/main.dart).
6. **Sharing:** An artist link (`/open/artists/:id`) and a Pro profile link (`/pro-networx/u/:id`) load signed out and open the installed app.
