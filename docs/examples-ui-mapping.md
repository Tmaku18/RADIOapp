# Examples/ UI Reference Mapping

This document maps each screenshot in `Examples/` to **Instagram** or **Twitch** design patterns. It is the source of truth for which reference applies to each image when implementing the Spotify/IG/Twitch UI merge.

## Spotify

**No Spotify screenshots exist in `Examples/`.** All persistent mini-player and Now Playing bar behavior is derived from online references:

- **Spotify Design**: "Small but Mighty: We've Rolled out Changes to the Now Playing Bar" — persistent bottom bar, expand to full view.
- **Chrome for Developers**: "How Spotify used the Picture-in-Picture API to build the Spotify Miniplayer" — compact bar, floating behavior.
- **Implementation**: Next.js App Router pattern — mount audio + mini-player in root layout so it never unmounts across route changes.

---

## Instagram patterns (settings, search, profile edit)

| File | Pattern | Use for |
|------|---------|--------|
| `Examples/attachments/IMG_3876.png` | Settings and activity | Sectioned settings list; back chevron; centered title "Settings and activity". |
| `Examples/attachments/IMG_3877.png` | Settings and activity | Same sectioned list layout (alternate crop). |
| `Examples/attachments/IMG_3878.png` | Settings and activity | Sectioned list: feature rows (icon + title + description + chevron), separator, Login (Add account, Log out). |
| `Examples/attachments/IMG_3879.png` | Edit profile | Profile edit form: avatar, display name, fields; Edit Profile context. |
| `Examples/attachments/IMG_3880.png` | Search / Activity | Search or activity screen with tabs and content. |
| `Examples/attachments/IMG_3881.png` | Search results | Search bar, category tabs (For you, Accounts, Audio, Tags, Places), Accounts list + Posts grid. |

---

## Twitch patterns (live discovery, profile, go-live, settings)

| File | Pattern | Use for |
|------|---------|--------|
| `Examples/attachments (2)/IMG_3887.png` | Browse (Twitch) | Browse section; search; Categories / Live Channels. |
| `Examples/attachments (2)/IMG_3888.png` | Browse – Live Channels | Search, Recent searches, Live Channels tab, sort dropdown (Recommended, Viewers, Recently started), live stream previews, bottom nav (Home, Browse, +, Activity, Profile). |
| `Examples/attachments (2)/IMG_3889.png` | Activity – Whispers | Activity title, Notifications / Whispers tabs, empty state "No Whispers Available", "Start a conversation", bottom nav. |
| `Examples/attachments (2)/IMG_3890.png` | Activity – Notifications | "You're all caught up"; Notifications / Whispers tabs; bottom nav. |
| `Examples/attachments (2)/IMG_3891.png` | Profile (Twitch) | Profile header (gear, Edit Profile), avatar, username, "Last live …", Stream Manager + Analytics buttons, tabs (Home, About, Clips, Videos, Sched), empty state, bottom nav with central +. |
| `Examples/attachments (2)/IMG_3892.png` | Settings (Twitch) | Sectioned settings: Creator Dashboard, Stream Manager, Moderation; Subscriptions, Drops & Rewards, Twitch Turbo; Account, Preferences, Notifications, Content Preferences, Security & Privacy. |
| `Examples/attachments (3)/IMG_3882.png` | (Twitch) | Additional Twitch layout reference. |
| `Examples/attachments (3)/IMG_3883.png` | Live stream viewer | Live video with overlay menu (Not interested, Block, Report, Close); Following / Live / Clips tabs. |
| `Examples/attachments (3)/IMG_3884.png` | Home – Following | Following / Live / Clips tabs; "Live Now" empty state; Offline list; bottom nav. |
| `Examples/attachments (3)/IMG_3885.png` | Live stream watch | Live stream with LIVE badge, viewer count, interaction icons (like, share, mute, fullscreen), streamer name, game category; bottom nav. |
| `Examples/attachments (3)/IMG_3886.png` | Browse – Categories | Search, Recent searches, Categories tab (grid: Just Chatting, games, viewer counts, tags); bottom nav. |
| `Examples/attachments (1)/IMG_3893.png` | Profile – Chat tab | Profile with Chat tab selected; "Welcome to … chatroom!"; Send chat input; bottom nav. |
| `Examples/attachments (1)/IMG_3894.png` | Profile (Twitch) | Profile header; About tab. |
| `Examples/attachments (1)/IMG_3895.png` | Create action sheet | "Create" modal: Stream Games, Stream IRL, Creator Dashboard; Cancel. |
| `Examples/attachments (1)/IMG_3896.png` | Go Live / Stream setup | Camera preview; stream title + category + Edit; Start button; Stream Manager, Activity Feed, Flip, Mute. |
| `Examples/attachments (1)/IMG_3897.png` | Edit Stream Info | Title, Go Live Notification, Category (with game card), Tags, Content Classification; Cancel / Done. |
| `Examples/attachments (1)/IMG_3898.png` | Edit Stream Info (more) | Tags, Content Classification, Language, Branded Content toggle, Stream Markers, Share Channel. |

---

## Summary

- **Instagram**: 6 images — settings list, edit profile, search with tabs and grid.
- **Twitch**: 17 images — browse/live channels/categories, activity (notifications/whispers), profile (tabs, Stream Manager, Chat), settings list, create sheet, go-live setup, Edit Stream Info.
- **Spotify**: 0 images in Examples; use online references only.

*Last updated to match plan: Spotify IG Twitch UI merge.*
