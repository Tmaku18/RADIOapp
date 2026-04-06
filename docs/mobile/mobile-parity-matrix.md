# Mobile Parity Matrix (Web -> Mobile)

Updated: 2026-04-04

## User-Facing Features

| Web Area | Mobile Status | Notes |
|---|---|---|
| Auth (email/google/apple) | Existing | Implemented in mobile auth service and login screens |
| Radio player/live indicators | Existing | Implemented in player + live services |
| Competition/Vote tabs | Existing | Implemented with live leaderboard metrics |
| Discovery (swipe/list) | Existing | Implemented with social/discovery modules |
| Messaging + notifications | Existing | Implemented in mobile messages + notifications |
| Profile core fields | Existing | Display name/headline/bio/location present |
| Profile social links (all) | Added | Instagram, X, TikTok, YouTube, SoundCloud, Spotify, Apple Music, Facebook, Snapchat, Website |
| Artist profile social rendering | Added | All social links now display on artist page |
| Pro-Networx (directory/profiles) | Existing | Implemented in mobile pro_networx features |
| Studio/upload/credits/refinery/yield | Existing | Present in current mobile routes |

## Admin Features

| Web Admin Area | Mobile Status | Notes |
|---|---|---|
| Admin dashboard analytics | Added | New in-app admin dashboard overview |
| Live broadcast start/stop | Added | Exposed in admin overview |
| Songs moderation | Added | Approve/reject/delete/trim/toggle free rotation |
| Queue manager | Added | Station queue load/edit/replace/skip/remove |
| Users management | Added | Search, role toggle, lifetime ban, delete |
| Swipe moderation | Added | Discover card list + delete clip |
| Feed moderation | Added | Remove/delete feed media |
| Fallback management | Added | Group toggle/delete and upload payload form |
| Free-rotation controls | Added | Search and toggle flow + list |
| Streamer approvals | Added | Approve/reject applications |

## Route Parity Additions (Mobile)

- `AppRoutes.adminDashboard`
- Role-gated admin route wrapper (`RequireAdmin`)
- Admin entry points from Settings and Home More menu

