# Mobile Parity Matrix (Web -> Mobile)

Updated: 2026-11-23

Condensed web-to-mobile view. Status values (`done`, `partial`, `missing`, `n/a`) and the full per-platform breakdown come from [docs/mobile-web-parity-matrix.md](../mobile-web-parity-matrix.md).

## User-Facing Features

| Web Area | Mobile Status | Notes |
|---|---|---|
| Auth (email / Google / Apple) + phone MFA | done | `mobile/lib/widgets/login_screen.dart`, `mobile/lib/features/auth/phone_mfa_gate.dart` |
| Guest browsing | done | `mobile/lib/core/auth/require_account.dart` prompts sign-in on actions |
| Radio player (votes, 1–10 rating, report, lyrics, Up Next) | done | `mobile/lib/features/player/player_screen.dart`, `widgets/player_chrome.dart` |
| Live Chat + per-song Comments | done | `mobile/lib/features/player/widgets/chat_panel.dart` |
| Song stories + clip recorder | done | `widgets/song_stories_strip.dart`, `radio_capture_screen.dart`; web records only from Pro-Radio |
| Swipe-down player / drag-to-open radio bar | done (mobile-only) | `player_screen.dart`, `mobile/lib/widgets/dimension/dimension_radio_bar.dart` |
| Venue ad slot | done (web missing) | Mobile shows it in the player; web component is not mounted |
| Competition / Vote | done | `mobile/lib/features/competition/competition_screen.dart` |
| Discover (Swipe, Artists, Library) | done | `mobile/lib/features/discovery/discovery_screen.dart`; artist scope Everyone / Following / Liked is mobile-only |
| Search | done | `mobile/lib/features/search/search_screen.dart` (glass artist cards, sort, scope, genre) |
| Feed posts | done | `mobile/lib/features/social/social_feed_screen.dart` |
| The Chat Room | done | `mobile/lib/features/room/room_screen.dart` |
| DMs (requests, reactions, media, send clip) | done | `mobile/lib/features/messages/` |
| Notifications inbox | done | `mobile/lib/features/notifications/notifications_screen.dart` |
| Profile + social links | done | Instagram, X, TikTok, YouTube, SoundCloud, Spotify, Apple Music, Facebook, Snapchat, Website |
| Artist profile + share | done | `mobile/lib/features/artist/artist_profile_screen.dart`, `share_artist_sheet.dart` |
| My Songs, upload, albums, Buy placements | done | `mobile/lib/features/studio/`, `mobile/lib/features/upload/`; purchases through App Store / Google Play |
| Analytics (The Wake) | done | `mobile/lib/features/analytics/analytics_screen.dart` |
| Refinery (submit, review, analytics) | done | `mobile/lib/features/refinery/` |
| Yield / rewards | done | `mobile/lib/features/yield/yield_screen.dart` |
| Live DJ, Live Performances, go live, watch live | done | `mobile/lib/features/livestream/` |
| Studios + Nearby | done | `mobile/lib/features/studios/`, `pro_networx/pro_studios_screen.dart` |
| Pro-Radio (hub, playlists, recorder) | done | `mobile/lib/features/pro_radio/` |
| Pro-Networx (Home, Discover, Search, Beats, Services, Studios, Projects, Radio) | done | `mobile/lib/features/pro_networx/` |
| Pro profile share | done | `pro_profile_screen.dart` |
| Pro onboarding form | missing | Mobile edits the same fields in My profile |
| Favorite artists, invite friends, listening tools | done (mobile-only) | Not on web |

## Admin Features

| Web Admin Area | Mobile Status | Notes |
|---|---|---|
| Admin dashboard analytics | done | Overview tab in `mobile/lib/features/admin/admin_dashboard_screen.dart` |
| Live broadcast start/stop | done | Overview tab |
| Songs moderation | done | Approve / reject / delete / trim / metadata / stations / copyright filter |
| Queue manager | done | Station queue load / edit / skip / remove; search and reorder in DJ Booth |
| DJ Booth | done | `mobile/lib/features/admin/dj_booth_screen.dart` |
| Users management | done | Search, role, lifetime ban, shadow ban, restore, delete (with confirmations) |
| Swipe moderation | partial | Clip list + delete; play/edit clip windows is web-only |
| Feed moderation | done | Remove / delete feed media |
| Fallback management | done | Group toggle / delete / station assignment / upload |
| Free-rotation controls | done | Search and toggle |
| Streamer approvals | done | Approve / reject applications |
| Reports, lyrics, payouts, activity flags | missing | Web admin only |

## Route Parity Additions (Mobile)

- `AppRoutes.adminDashboard`, `AppRoutes.adminDjBooth`
- `AppRoutes.search`, `AppRoutes.listening`
- `AppRoutes.proRadio`, `AppRoutes.studios`, `AppRoutes.studioProfile`, `AppRoutes.myStudio`
- `AppRoutes.liveDj`, `AppRoutes.livePerformances`
- `AppRoutes.refineryReview`, `AppRoutes.refineryAnalytics`
- Role-gated wrappers: `RequireAdmin`, `RequireArtist`, `RequireGemCapability`
- Admin entry points from the drawer (Account & settings → Admin)
