# Web to Mobile Parity Matrix (Non-Admin)

This matrix tracks parity between web routes and Flutter mobile routes. Feature-level status (including Android vs iOS and admin) lives in [docs/mobile-web-parity-matrix.md](../../docs/mobile-web-parity-matrix.md). Mobile route names are defined in `mobile/lib/core/navigation/app_routes.dart`.

## Core Routes

| Web Route | Mobile Route | Status | Notes |
| --- | --- | --- | --- |
| `/login`, `/signup` | `/login` | Complete | Role picker (multiple maker roles) and phone MFA on both. |
| `/dashboard` | `/home` (Networx Home + Gem dashboard) | Complete | Bottom bar: Home, Radio, Feed, Discover, Vote (listeners) or Pro (creators). |
| `/listen` | `/player` (Radio tab) | Complete | Votes, 1–10 rating, report, lyrics, Live Chat + Comments, song stories. Mobile adds swipe-down to close and clip recording. |
| `/pro-radio` | `/pro-radio` | Complete | Hub, playlists, clip recorder. |
| `/room` | `/room` | Complete | The Chat Room. |
| `/social` | Feed tab | Complete | Feed posts. |
| `/social/discover`, `/social/discover/list` | `/discovery` (Swipe, Library tabs) | Complete | Swipe and library. |
| `/discover` (Artists tab) | `/discovery` (Artists tab), `/search` | Partial | Both: glass artist cards with Popular / Most songs / Recent. Mobile only: Everyone / Following / Liked scope. |
| `/discover/create-video` | `/discover-create-video` | Complete | |
| `/competition` | `/competition` | Complete | Leaderboards and Top 7 vote. |
| `/messages` | `/messages`, `/messages/thread` | Complete | Chats + Requests tabs, reactions, media. |
| `/notifications` | `/notifications` | Complete | |
| `/profile` | `/profile` | Complete | |
| `/artist/[id]`, `/open/artists/[id]` | `/artist-profile` | Complete | Share link opens the app via App Links / Universal Links. |
| `/settings`, `/settings/notifications`, `/settings/blocked`, `/settings/theme` | `/settings`, `/settings/notifications`, `/settings/blocked` | Complete | Theme is a section of mobile Settings. |
| `/settings/playback`, `/settings/security` | `/settings` | Partial | Mobile Settings covers these in sections, plus Listening (sleep timer, history). |
| `/help-legal` | `/help-legal` | Complete | |
| `/stream-settings` | `/stream-settings` | Complete | |
| `/go-live` | `/go-live` | Complete | DJ or musician host type. |
| `/live`, `/dj`, `/performances` | `/live`, `/live-dj`, `/live-performances` | Complete | |
| `/watch/[artistId]` | `/watch-live` | Complete | |
| `/studios`, `/studios/[id]`, `/studios/me` | `/studios`, `/studios/view`, `/studios/me` | Complete | Directory + Nearby (list / map). |
| `/refinery`, `/refinery/review/[songId]`, `/refinery/analytics/[songId]` | `/refinery`, `/refinery-review`, `/refinery-analytics` | Complete | |
| `/yield` | `/yield` | Complete | |
| `/job-board` | `/job-board` | Complete | |
| `/artist/songs`, `/artist/upload` | `/studio` (My Songs), `/upload` | Complete | |
| `/artist/songs/[id]/buy-plays` | `/buy-plays` | Complete | Web: Stripe. Mobile: App Store / Google Play. |
| `/artist/credits` | `/credits` (Placements) | Complete | Placement and transaction history. |
| `/artist/stats` | `/analytics` | Complete | |
| `/artist/payouts` | `/studio` (payouts section) | Complete | Stripe Connect. |
| `/artist/live-services` | `/live-services` | Complete | |
| `/pro-networx/home`, `/feed`, `/search`, `/beats`, `/services`, `/studios`, `/jobs`, `/radio` | `/pro-networx/shell` (tabs) | Complete | Same eight tabs. |
| `/pro-networx/u/[id]` | `/pro-profile` | Complete | Share (Text / Send in a DM). |
| `/pro-networx/me`, `/pro-networx/me/services`, `/pro-networx/me/studio` | `/pro-me-profile`, `/pro-networx/my-services`, `/studios/me` | Complete | |
| `/pro-networx/services/[id]`, `/pro-networx/explore/[postId]` | `/pro-networx/service-detail`, `/pro-networx/explore-detail` | Complete | |
| `/pro-networx/onboarding` | — | Missing | Mobile edits the same fields in `/pro-me-profile`. |
| `/saved`, `/liked` | `/saved-posts`, `/liked-posts` | Complete | |
| — | `/listening` | Mobile-only | Sleep timer, recent listening, offline favorites. |

## Explicitly Excluded (By Scope)

- Web admin routes: `/admin/*` (see the Admin section of the source-of-truth matrix)
- Web-only cross-domain auth pages and exchange routes (`/cross-domain-login`, `/auth-handoff`)
- Marketing and legal pages under `(marketing)`
- PWA-only offline route behavior (`/~offline`)

## Remaining Enhancements (Non-Blocking)

1. Add a mobile Pro-Networx onboarding flow to mirror `/pro-networx/onboarding`.
2. Bring the Everyone / Following / Liked artist scope to web `/discover`.
3. Mount the venue ad slot on the web player.
