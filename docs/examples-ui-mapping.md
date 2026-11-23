# Examples/ UI Reference Mapping

This document maps each screenshot in `Examples/` to **Instagram** or **Twitch** design patterns and to the web and mobile files that implement each pattern today. It is the source of truth for which reference applies to each image when working on the Spotify/IG/Twitch-style UI.

## Spotify

**No Spotify screenshots exist in `Examples/`.** All persistent mini-player and Now Playing bar behavior is derived from online references:

- **Spotify Design**: "Small but Mighty: We've Rolled out Changes to the Now Playing Bar" — persistent bottom bar, expand to full view.
- **Chrome for Developers**: "How Spotify used the Picture-in-Picture API to build the Spotify Miniplayer" — compact bar, floating behavior.
- **Web implementation**: audio and the bottom bar are mounted from the root layout (`web/src/app/layout.tsx`) through `web/src/components/playback/PlaybackLayout.tsx` and `web/src/components/playback/NowPlayingBar.tsx`, which renders `web/src/components/dimension/DimensionRadioBar.tsx`, so playback never unmounts across route changes. The full player is `web/src/components/radio/RadioPlayer.tsx`.
- **Mobile implementation**: the persistent bar is `mobile/lib/widgets/dimension/dimension_radio_bar.dart` (aliased as `MiniPlayerBar` in `mobile/lib/widgets/mini_player_bar.dart`); dragging it opens `mobile/lib/features/player/player_screen.dart`, and a downward swipe closes the player.

---

## Instagram patterns (settings, search, profile edit)

| File | Pattern | Use for | Implemented in |
|------|---------|--------|----------------|
| `Examples/attachments/IMG_3876.png` | Settings and activity | Sectioned settings list; back chevron; centered title "Settings and activity". | `web/src/app/(dashboard)/settings/page.tsx`; `mobile/lib/features/settings/settings_screen.dart` |
| `Examples/attachments/IMG_3877.png` | Settings and activity | Same sectioned list layout (alternate crop). | Same as above |
| `Examples/attachments/IMG_3878.png` | Settings and activity | Sectioned list: feature rows (icon + title + description + chevron), separator, Login (Add account, Log out). | Same as above; blocked accounts in `web/src/app/(dashboard)/settings/blocked/page.tsx`, `mobile/lib/features/settings/blocked_accounts_screen.dart` |
| `Examples/attachments/IMG_3879.png` | Edit profile | Profile edit form: avatar, display name, fields; Edit Profile context. | `web/src/app/(dashboard)/profile/page.tsx`; `mobile/lib/features/profile/profile_screen.dart` |
| `Examples/attachments/IMG_3880.png` | Search / Activity | Search or activity screen with tabs and content. | `mobile/lib/features/search/search_screen.dart`; `web/src/app/(dashboard)/discover/page.tsx` |
| `Examples/attachments/IMG_3881.png` | Search results | Search bar, category tabs (For you, Accounts, Audio, Tags, Places), Accounts list + Posts grid. | Artist results as glass cards: `web/src/components/dimension/ArtistGlassCard.tsx`, `mobile/lib/widgets/dimension/artist_glass_card.dart`; Pro search: `web/src/app/(ProNetworx)/pro-networx/(dashboard)/search/page.tsx`, `mobile/lib/features/pro_networx/pro_search_screen.dart` |

---

## Twitch patterns (live discovery, profile, go-live, settings)

| File | Pattern | Use for | Implemented in |
|------|---------|--------|----------------|
| `Examples/attachments (2)/IMG_3887.png` | Browse (Twitch) | Browse section; search; Categories / Live Channels. | `web/src/app/(dashboard)/live/page.tsx`; `mobile/lib/features/livestream/live_sessions_screen.dart` |
| `Examples/attachments (2)/IMG_3888.png` | Browse – Live Channels | Search, Recent searches, Live Channels tab, sort dropdown (Recommended, Viewers, Recently started), live stream previews, bottom nav (Home, Browse, +, Activity, Profile). | Live listings with viewer sort: `web/src/app/(dashboard)/live/page.tsx`, `dj/page.tsx`, `performances/page.tsx`; `mobile/lib/features/livestream/live_sessions_screen.dart` (Live DJ / Live Performances modes) |
| `Examples/attachments (2)/IMG_3889.png` | Activity – Whispers | Activity title, Notifications / Whispers tabs, empty state "No Whispers Available", "Start a conversation", bottom nav. | DMs with Chats / Requests tabs: `web/src/app/(dashboard)/messages/page.tsx`; `mobile/lib/features/messages/messages_screen.dart` |
| `Examples/attachments (2)/IMG_3890.png` | Activity – Notifications | "You're all caught up"; Notifications / Whispers tabs; bottom nav. | `web/src/app/(dashboard)/notifications/page.tsx`; `mobile/lib/features/notifications/notifications_screen.dart` |
| `Examples/attachments (2)/IMG_3891.png` | Profile (Twitch) | Profile header (gear, Edit Profile), avatar, username, "Last live …", Stream Manager + Analytics buttons, tabs (Home, About, Clips, Videos, Sched), empty state, bottom nav with central +. | Artist profile with Go live / live badge: `web/src/components/artist/ArtistPageView.tsx`; `mobile/lib/features/artist/artist_profile_screen.dart` |
| `Examples/attachments (2)/IMG_3892.png` | Settings (Twitch) | Sectioned settings: Creator Dashboard, Stream Manager, Moderation; Subscriptions, Drops & Rewards, Twitch Turbo; Account, Preferences, Notifications, Content Preferences, Security & Privacy. | `web/src/app/(dashboard)/stream-settings/page.tsx`, `web/src/app/(dashboard)/settings/security/page.tsx`; `mobile/lib/features/livestream/stream_settings_screen.dart` |
| `Examples/attachments (3)/IMG_3882.png` | (Twitch) | Additional Twitch layout reference. | Live listings (see IMG_3888) |
| `Examples/attachments (3)/IMG_3883.png` | Live stream viewer | Live video with overlay menu (Not interested, Block, Report, Close); Following / Live / Clips tabs. | `web/src/app/(dashboard)/watch/[artistId]/page.tsx`; `mobile/lib/features/livestream/watch_live_screen.dart`, `mobile/lib/features/livestream/widgets/live_stream_viewer.dart` |
| `Examples/attachments (3)/IMG_3884.png` | Home – Following | Following / Live / Clips tabs; "Live Now" empty state; Offline list; bottom nav. | `web/src/app/(dashboard)/live/page.tsx`; `mobile/lib/features/livestream/live_sessions_screen.dart` |
| `Examples/attachments (3)/IMG_3885.png` | Live stream watch | Live stream with LIVE badge, viewer count, interaction icons (like, share, mute, fullscreen), streamer name, game category; bottom nav. | Same as IMG_3883 |
| `Examples/attachments (3)/IMG_3886.png` | Browse – Categories | Search, Recent searches, Categories tab (grid: Just Chatting, games, viewer counts, tags); bottom nav. | Station grid on Discover → Stations: `web/src/app/(dashboard)/discover/page.tsx`, `web/src/components/discovery/StationNetworkSelector.tsx` |
| `Examples/attachments (1)/IMG_3893.png` | Profile – Chat tab | Profile with Chat tab selected; "Welcome to … chatroom!"; Send chat input; bottom nav. | Stream chat: `web/src/components/stream/LiveChat.tsx`, `mobile/lib/features/livestream/widgets/live_chat_panel.dart`; radio chat: `web/src/components/chat/ChatSidebar.tsx`, `mobile/lib/features/player/widgets/chat_panel.dart` |
| `Examples/attachments (1)/IMG_3894.png` | Profile (Twitch) | Profile header; About tab. | `web/src/components/artist/ArtistPageView.tsx`; `mobile/lib/features/artist/artist_profile_screen.dart` |
| `Examples/attachments (1)/IMG_3895.png` | Create action sheet | "Create" modal: Stream Games, Stream IRL, Creator Dashboard; Cancel. | Go live as DJ or musician: `web/src/app/(dashboard)/go-live/page.tsx`; `mobile/lib/features/livestream/go_live_screen.dart` |
| `Examples/attachments (1)/IMG_3896.png` | Go Live / Stream setup | Camera preview; stream title + category + Edit; Start button; Stream Manager, Activity Feed, Flip, Mute. | `web/src/app/(dashboard)/go-live/page.tsx`, `web/src/components/stream/CameraBroadcaster.tsx`; `mobile/lib/features/livestream/go_live_screen.dart` |
| `Examples/attachments (1)/IMG_3897.png` | Edit Stream Info | Title, Go Live Notification, Category (with game card), Tags, Content Classification; Cancel / Done. | Title and category fields on `web/src/app/(dashboard)/go-live/page.tsx`; title on `mobile/lib/features/livestream/go_live_screen.dart` |
| `Examples/attachments (1)/IMG_3898.png` | Edit Stream Info (more) | Tags, Content Classification, Language, Branded Content toggle, Stream Markers, Share Channel. | Same as IMG_3897 |

---

## Summary

- **Instagram**: 6 images — settings list, edit profile, search with tabs and grid.
- **Twitch**: 17 images — browse/live channels/categories, activity (notifications/whispers), profile (tabs, Stream Manager, Chat), settings list, create sheet, go-live setup, Edit Stream Info.
- **Spotify**: 0 images in Examples; use online references only.
- NETWORX uses a left navigation drawer plus a bottom bar (mobile: Home, Radio, Feed, Discover, Vote or Pro) in place of Twitch's five-item bottom nav.
