# Web to Mobile Parity Matrix (Non-Admin)

This matrix tracks parity between web routes and Flutter mobile implementations.

## Core Routes

| Web Route | Mobile Route | Status | Notes |
| --- | --- | --- | --- |
| `/login`, `/signup` | `/login` (+ role-aware profile/apply flows) | Partial | Signup role UX remains embedded in auth/profile flow. |
| `/dashboard` | `/home` | Complete | Role-based tabs for listener and artist/service-provider. |
| `/listen` | `/player` | Complete | Radio playback, voting, ads, chat, artist deep-link. |
| `/discover` | `/discovery` | Complete | Feed + map + competition modules available in one screen. |
| `/competition` | `/competition` | Complete | Vote and leaderboard parity implemented. |
| `/messages` | `/messages`, `/messages/thread` | Complete | Threads, send, paywall-aware messaging. |
| `/profile` | `/profile` | Complete | Profile + creator shortcuts. |
| `/settings`, `/settings/notifications` | `/settings` | Complete | Theme, notifications, discoverability, account sections. |
| `/stream-settings` | `/stream-settings` | Complete | Request access + go-live manager routing. |
| `/watch/[artistId]` | `/watch-live` | Complete | Join/watch flow and donation intent setup. |
| `/job-board` | `/job-board` | Complete | Previously orphaned; now reachable from app navigation. |
| `/refinery` | `/refinery` | Complete | Listener rewards/refinery path. |
| `/yield` | `/yield` | Complete | Listener rewards path. |
| `/pro-directory`, `/pro-networx/*` | `/pro-directory`, `/pro-profile`, `/pro-me-profile` | Complete | Directory, profile, DM entry, profile editing. |
| `/artist/songs/*`, `/artist/upload`, `/artist/credits`, `/artist/stats` | `/studio`, `/upload`, `/credits`, `/analytics`, `/buy-plays` | Complete | Studio flow with payment and credits coverage. |

## Explicitly Excluded (By Scope)

- Web admin routes: `/admin/*`
- Web-only cross-domain auth pages and exchange routes
- PWA-only offline route behavior

## Remaining Enhancements (Non-Blocking)

1. Add a dedicated mobile signup/role onboarding route to mirror web signup page structure.
2. Add richer Pro-Networx feed/onboarding screen parity where web uses separate dashboards.
3. Expand deep-link table for all push payload variants beyond analytics/player/watch-live.
