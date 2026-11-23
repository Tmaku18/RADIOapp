# Deliverables Verification Report

**Generated:** February 1, 2026  
**Re-verified against code:** 2026-11-23 (mobile 1.0.99+133, migrations through `149_unique_display_names.sql`)  
**Project:** NETWORX Radio + Pro-Networx  
**Overall Status:** All deliverables from the February report are implemented; remaining gaps are listed under Partial Implementations.

> **Update (February 2026)**: Web signed-upload song creation now captures and submits audio duration so Admin Songs no longer shows `3:00` for every track. Legacy rows may still have `duration_seconds=180` in DB, but the admin table can display real duration from audio metadata.

---

## Executive Summary

This report verifies the features claimed in the README and product docs against the codebase. The February gaps are closed: trial rotation and the four-tier rotation fallback run in `radio.service.ts`, "Up Next" pushes are scheduled from the radio loop, chat archival has its tables and RPC, and the marketing pages revalidate. The credit bank described in February has been retired in favor of per-song Discovery placements, and mobile digital purchases now go through the App Store and Google Play.

---

## ✅ FULLY IMPLEMENTED FEATURES

### Authentication & User Management (9/9 - 100%)

| Feature | Status | Evidence |
|---------|--------|----------|
| Firebase Auth (Email/Password, Google, Apple) | ✅ | `mobile/lib/core/auth/auth_service.dart`, `backend/src/auth/guards/firebase-auth.guard.ts` |
| User profile creation linked to Firebase | ✅ | `backend/src/users/users.service.ts` `createUser()` |
| Role-based access control (multiple maker roles) | ✅ | `backend/src/auth/decorators/roles.decorator.ts`, `backend/src/auth/guards/roles.guard.ts`, `users.user_roles` (migration 145) |
| HTTP-only session cookies (web) | ✅ | `web/src/app/api/auth/login/route.ts`, `logout/route.ts` |
| Hard ban with token revocation | ✅ | `backend/src/admin/admin.service.ts` `hardBanUser()`; guard rejects `is_banned` users |
| Upgrade listener to artist / Catalyst | ✅ | `users.service.ts` `upgradeToArtist()`, `upgradeToCatalyst()`; auto-promote in `backend/src/users/promote-listener.ts` |
| Phone MFA on every sign-in | ✅ | `backend/src/auth/guards/phone-mfa.guard.ts` (global), `POST /auth/phone/send|verify`, `web/src/components/auth/PhoneMfaGate.tsx`, `mobile/lib/features/auth/phone_mfa_gate.dart` |
| Account deletion with 48-hour restore | ✅ | `users.service.ts` `scheduleAccountDeletion()`, `backend/src/tasks/cleanup.service.ts` `purgeScheduledAccountDeletions()` |
| Unique display names and usernames | ✅ | Migration `149_unique_display_names.sql`, `GET /users/username-available` |

### Payments & Placements (8/8 - 100%)

| Feature | Status | Evidence |
|---------|--------|----------|
| Per-song Discovery placements (100 exposures each) | ✅ | `backend/src/payments/payments.service.ts` `EXPOSURES_PER_PLACEMENT`, `songs.credits_remaining` |
| Web checkout (Stripe) | ✅ | `POST /payments/checkout-session-song-plays`, `web/src/app/(dashboard)/artist/songs/[id]/buy-plays/page.tsx` |
| Mobile store purchases (App Store / Google Play) | ✅ | `POST /payments/app-store/complete`, `/google-play/complete`, `mobile/lib/core/services/play_billing_service.dart`, `pending_purchase_queue.dart` |
| Store notifications and refunds | ✅ | `POST /payments/app-store/notifications`, `POST /payments/google-play/rtdn` |
| Stripe webhook | ✅ | `payments.controller.ts` `handleWebhook()` |
| Welcome placements (10 at signup) | ✅ | `backend/src/credits/welcome-placements.ts`, `POST /credits/songs/:songId/apply-welcome-placements` |
| Subscriptions (Pro-Networx, Pro-Radio, bundle) | ✅ | `create-pro-*-checkout-session` / `-payment-sheet`, `*/complete-subscription`, `pro-*-subscription` modules |
| Stripe Connect payouts for song sales | ✅ | `POST /payments/connect/onboard`, `GET /payments/connect/status`, `web/src/app/(dashboard)/artist/payouts/page.tsx` |

### Radio Core (9/9 - 100%)

| Feature | Status | Evidence |
|---------|--------|----------|
| Server time sync & position tracking | ✅ | `backend/src/radio/radio.service.ts` `getCurrentTrack()`; clients `web/src/lib/radio-sync.ts`, `mobile/lib/core/radio/radio_sync.dart` |
| Soft-weighted random selection | ✅ | `radio.service.ts` `selectWeightedRandom()` |
| Pre-charge model (atomic RPC) | ✅ | `deduct_play_credits` RPC in `radio.service.ts` |
| Algorithm transparency (`play_decision_log`) | ✅ | `backend/src/radio/radio-state.service.ts` `logPlayDecision()`; pruned by `cleanup.service.ts` `prunePlayDecisionLog()` |
| Redis state management (per station) | ✅ | `radio-state.service.ts` `redisKeys()` (`radio:{stationId}:*`) |
| Hysteresis thresholds | ✅ | `THRESHOLD_ENTER_PAID` (default 5), `THRESHOLD_EXIT_PAID` (default 3), env-overridable |
| Trial rotation (3 free plays) | ✅ | `radio.service.ts` `getTrialSong()`; default 3 in `004_trial_and_cooldowns.sql` |
| Four-tier fallback | ✅ | Paid mode: `getCreditedSong()` → `getTrialSong()` → `getOptInSong()` → `getNextFreeRotationSong()` |
| Multiple stations | ✅ | Station-scoped queues; `mobile/lib/core/radio/station_catalog.dart` |

### Mobile App (8/8 - 100%)

| Feature | Status | Evidence |
|---------|--------|----------|
| Navigation drawer + bottom bar (role-based) | ✅ | `mobile/lib/widgets/dimension/dimension_nav_drawer.dart`; `mobile/lib/widgets/home_screen.dart` (Home, Radio, Feed, Discover, Vote or Pro) |
| Fire / poop votes on player | ✅ | `mobile/lib/features/player/widgets/player_chrome.dart` (`onReact`) |
| Placements & transaction history | ✅ | `mobile/lib/features/credits/credits_screen.dart`, `mobile/lib/features/studio/buy_plays_screen.dart` |
| Store billing | ✅ | `in_app_purchase` in `mobile/pubspec.yaml`, `play_billing_service.dart` |
| Firebase Auth integration | ✅ | `mobile/lib/core/auth/auth_service.dart` |
| Audio streaming (`just_audio` + `audio_service`) | ✅ | `mobile/lib/core/services/audio_player_service.dart`, `audio_handler.dart` |
| Push notifications with deep-link routing | ✅ | `mobile/lib/core/services/push_notification_service.dart`, `mobile/lib/main.dart` |
| Lock screen and car surfaces | ✅ | `mobile/ios/NowPlayingWidget/`, `mobile/ios/Runner/LiveActivityBridge.swift`, `mobile/android/app/src/main/res/xml/automotive_app_desc.xml` |

### Web App (8/9 - 89%)

| Feature | Status | Evidence |
|---------|--------|----------|
| Session cookie auth | ✅ | `web/src/app/api/auth/login/route.ts` |
| Role-aware dashboard | ✅ | `web/src/app/(dashboard)/layout.tsx` (listener and creator nav lists) |
| Radio player (Hls.js, LIVE, mute) | ✅ | `web/src/components/radio/RadioPlayer.tsx`, `useRadioState.ts` |
| Persistent bottom player | ✅ | `web/src/components/playback/NowPlayingBar.tsx`, `web/src/components/dimension/DimensionRadioBar.tsx` |
| Artist upload (signed URLs) | ✅ | `web/src/app/(dashboard)/artist/upload/page.tsx` |
| Buy placements (Stripe Checkout) | ✅ | `web/src/app/(dashboard)/artist/songs/[id]/buy-plays/page.tsx` |
| Admin dashboard (moderation, bans) | ✅ | `web/src/app/(dashboard)/admin/songs/page.tsx`, `admin/users/page.tsx` |
| Role selection | ✅ | `web/src/components/auth/RoleSelectionModal.tsx`, `web/src/app/(auth)/signup/page.tsx` |
| Venue ad slot on player | ⚠️ | `web/src/components/radio/VenueAdSlot.tsx` exists but is not mounted |

### Observability (4/4 - 100%)

| Feature | Status | Evidence |
|---------|--------|----------|
| Winston structured logging | ✅ | `backend/src/common/logger/logger.service.ts` |
| Request ID middleware | ✅ | `backend/src/common/middleware/request-id.middleware.ts` |
| Sentry integration | ✅ | `backend/src/common/sentry/sentry.service.ts`; `sentry_flutter` on mobile |
| Global exception filter | ✅ | `backend/src/common/filters/all-exceptions.filter.ts` |

### Notifications (6/6 - 100%)

| Feature | Status | Evidence |
|---------|--------|----------|
| In-app notifications | ✅ | `backend/src/notifications/notification.service.ts` |
| Email (SendGrid/Resend) | ✅ | `backend/src/email/email.service.ts` |
| Notification bell + unread count | ✅ | `web/src/app/(dashboard)/layout.tsx`, `GET /notifications/unread-count`, `mobile/lib/widgets/notifications_bell_button.dart` |
| Soft delete (audit trail) | ✅ | `notification.service.ts` `delete()` (`deleted_at`) |
| 4-hour artist push cooldown + daily cap | ✅ | `push-notification.service.ts` `COOLDOWN_HOURS = 4`, `DAILY_PUSH_LIMIT = 6` |
| "Up Next" push | ✅ | `radio.service.ts` `checkAndScheduleUpNext()` → `scheduleUpcomingPlayNotification()` at about 5 minutes and 1 minute before play; followers via `notifyFollowersArtistUpNext()` |

### Admin Features (9/9 - 100%)

| Feature | Status | Evidence |
|---------|--------|----------|
| Live chat (Supabase Realtime) + per-song Comments | ✅ | `backend/src/chat/chat.service.ts`, `GET /chat/comments` |
| Song moderation + rejection reasons | ✅ | `admin.service.ts` `updateSongStatus()` |
| Song delete (permanent, DB + storage) | ✅ | `admin.service.ts` `deleteSong()` |
| Sort songs by artist name | ✅ | `admin.service.ts` `sortColumnMap` |
| Hard / shadow ban and restore | ✅ | `admin.service.ts` `hardBanUser()`, `shadowBanUser()`, `restoreUser()` |
| Lifetime ban / deactivate account | ✅ | `admin.service.ts` `lifetimeBanUser()` |
| Free rotation search/toggle | ✅ | `/admin/free-rotation/*` |
| Fallback playlist (upload + song database) | ✅ | `/admin/fallback-songs*`, `web/src/app/(dashboard)/admin/fallback/upload`, `fallback/song-database` |
| Activity flags (vote / comment floods) | ✅ | `backend/src/common/vote-integrity.ts`, `admin.service.ts` `getActivityFlags()`, `web/src/app/(dashboard)/admin/users/page.tsx` |

### Scheduled Tasks (Chat Archival) — resolved

- `backend/src/tasks/cleanup.service.ts` `archiveOldChatMessages()` runs hourly.
- `backend/supabase/migrations/005_chat_archival.sql` creates `chat_config`, `chat_archives`, and `archive_old_chat_messages()`.

### Marketing Pages ISR — resolved

| Page | Status |
|------|--------|
| Homepage | ✅ `revalidate = 60` |
| About | ✅ `revalidate = 3600` |
| Pricing | ✅ `revalidate = 3600` |
| FAQ | ✅ `revalidate = 3600` |
| Contact | Client component (form); no ISR needed |

---

## ⚠️ PARTIAL IMPLEMENTATIONS

### 1. Shadow Ban Scope

**Actual Status:** By design (chat-only)

- Shadow ban hides chat messages from others (`chat.service.ts` checks `is_shadow_banned`).
- `FirebaseAuthGuard` checks `is_banned` and account deletion state; shadow-banned users keep API access.

### 2. Opt-in Tier Source

**Actual Status:** Implemented with a different flag

- `getOptInSong()` selects approved songs with `admin_free_rotation = true` whose trial plays and placements are used up.
- The `songs.opt_in_free_play` column is not used for selection.

### 3. Retired Credit Endpoints

**Actual Status:** Routed but retired

- `POST /credits/songs/:songId/allocate` and `/withdraw` remain registered and return 400 ("Credits are no longer used").
- `POST /payments/create-intent` and `/create-checkout-session` return 400 ("Credit packages are no longer sold").
- Web `/artist/songs/[id]/allocate` redirects to Buy placements.

### 4. Web Venue Ad Slot

**Actual Status:** Mobile only

- Mobile shows the venue card in `mobile/lib/features/player/widgets/player_chrome.dart`.
- Web `VenueAdSlot.tsx` is not rendered by any page.

### 5. Artist Live Ban

**Actual Status:** API only

- `POST /artist-live/admin/artists/:artistId/ban` exists; no web, admin-app, or mobile screen calls it. Admin force-stop is wired on web (`admin/streamers`, `watch/[artistId]`) and mobile (`watch_live_screen.dart`).

---

## ❌ NOT IMPLEMENTED

None of the February "not implemented" items remain open:

| Claimed Feature | Status | Notes |
|-----------------|--------|-------|
| Trial rotation (3 free plays) | ✅ | `getTrialSong()` |
| Opt-in free play song selection | ✅ | `getOptInSong()` (see Partial #2) |
| "Up Next" push notification | ✅ | `checkAndScheduleUpNext()` |

---

## 📋 DOCUMENTATION GAPS

The February list of tables and columns missing from `docs/database-schema.md` (`notifications`, `play_decision_log`, `admin_fallback_songs`, `radio_playlist_state`, `credit_allocations`, `artist_notification_cooldowns`, `chat_messages`, `chat_archives`, `chat_config`, and the ban, rotation, and checkout columns) is now covered in that doc. `transactions.payment_method` (added in migration `045_backend_parity_schema_and_storage.sql`) is the one listed column still not documented there.

---

## Summary Statistics

| Category | Implemented | Total | Percentage |
|----------|-------------|-------|------------|
| Authentication | 9 | 9 | 100% |
| Payments/Placements | 8 | 8 | 100% |
| Radio Core | 9 | 9 | 100% |
| Mobile App | 8 | 8 | 100% |
| Web App | 8 | 9 | 89% |
| Observability | 4 | 4 | 100% |
| Notifications | 6 | 6 | 100% |
| Admin Features | 9 | 9 | 100% |
| **Overall** | **61** | **62** | **98%** |

---

## README Claims Re-checked

1. **"Trial rotation: New approved songs get 3 free plays"** — accurate.
2. **"Four-tier fallback: credited → trial → opt-in → admin fallback"** — accurate (opt-in uses the free-rotation flag).
3. **"Up Next (T-60s)" push notifications** — accurate; pushes go out at about 5 minutes and 1 minute before play.
4. **Credit bank / allocate wording** — the README at this verification still describes buying credits and allocating them to tracks; the shipped flow is per-song placements.

---

## Recommendations

### High Priority
1. Replace credit-bank wording in the README with per-song placements.
2. Mount `VenueAdSlot` on the web player, or drop the web claim.

### Medium Priority
1. Remove the retired credit endpoints once no client calls them.
2. Add an admin screen for the artist live ban endpoint.
3. Document `transactions.payment_method` in `docs/database-schema.md`.

### Low Priority
1. Decide whether `songs.opt_in_free_play` should feed the opt-in tier or be dropped.

---

## Conclusion

The platform is in store release (mobile 1.0.99) with:
- ✅ Firebase authentication with phone MFA and account recovery window
- ✅ Per-song placements on Stripe, App Store, and Google Play, plus subscriptions and payouts
- ✅ Multi-station synchronized radio with Redis state and four-tier rotation
- ✅ Mobile and web applications, including Pro-Networx and Pro-Radio
- ✅ Admin dashboard and moderation tools on web, the admin app, and mobile
- ✅ Observability and error tracking

The remaining gaps are small: the unmounted web venue ad slot, retired credit endpoints still routed, and an API-only artist live ban.
