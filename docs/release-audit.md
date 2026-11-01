# NetworX Radio — pre-public-release audit

Audit date: 2026-11-01. Scope: Flutter app in `mobile/` first, plus the NestJS and Next.js pieces the app depends on. Goal: commercial App Store and Google Play launch.

Three things are already solid:

- Digital goods on iOS and Android go through in-app purchase (`mobile/lib/core/utils/mobile_store.dart`), not Stripe checkout.
- Sign in with Apple is offered on iOS, and Settings already has in-app account deletion (`DELETE /users/me`).
- Radio playback treats a dropped request differently from an empty station and shows a retry path.

Everything below is tagged **BLOCKER** (store rejection or legal risk), **HIGH**, **MEDIUM**, or **LOW**.

---

## BLOCKER

| Finding | Where | Fix |
|---|---|---|
| No report or block UI, despite DMs, feed, Discover, chat, and live | Backend exists (`users.controller.ts` block/report). Mobile only has unused `browse_service.dart` `report()`. | Shared report/block sheet on profiles, DMs, posts, live chat. Blocked-accounts screen. Filter blocked content. |
| Sign-up has no Terms / Community Guidelines acceptance | `mobile/lib/widgets/login_screen.dart` | Required checkbox before the account is created, including Google/Apple first-run. Store `terms_accepted_at`. |
| No "Forgot password" | No `sendPasswordResetEmail` in `lib/` | Link on the sign-in form. |
| Subscription paywalls missing Apple 3.1.2 disclosures | `pro_radio_paywall_sheet.dart`, `pro_network_paywall_sheet.dart` | Terms, Privacy, auto-renew wording, Manage subscription. Read intro price from the store product. |
| iOS links to a Stripe pricing page | `help_legal_screen.dart`, `about_screen.dart` → `pro-networx.com/pricing` | Hide when `isAppStorePlatform`. |
| `BETA_ALL_FREE` defaults to free | `backend/src/common/beta-access.ts` | Default to paid unless the env var is explicitly `true`. Remove "free during beta" copy. Set the Railway var to `false`. |
| Android release cannot be signed on this Mac | JDK 11 installed; Gradle wants 17. `mobile/android/key.properties` missing. | Install JDK 17 and recreate `key.properties` from the example. Account action. |

## HIGH

| Finding | Where |
|---|---|
| Real secrets committed: Apple IAP private key, ACRCloud, ElevenLabs in `backend/.env`; Firebase service-account key in `web/.env.vercel.production` | Root `.gitignore` allows them. Rotate, untrack, scrub history. Account action before history rewrite. |
| Sign in with Apple tokens are not revoked on delete | No `appleid.apple.com/auth/revoke` call. Capture the authorization code and revoke on delete. |
| Account deletion does not cancel Stripe subscriptions or tell store subscribers to cancel | `settings_screen.dart` delete dialog; `admin.service` / users delete path. |
| No iOS privacy manifest | Add `mobile/ios/Runner/PrivacyInfo.xcprivacy`. |
| Hardcoded "$1.99 first month" on store paywalls | `pro_radio_paywall_sheet.dart`, `app_tutorial.dart`. |
| No crash reporting or global error handler | `mobile/lib/main.dart`. Add Sentry (or Crashlytics). |
| Health check returns HTTP 200 when Supabase is down | `backend/src/app.controller.ts`. Return 503 when degraded so an uptime monitor can page. |
| Google sign-in cancel shows Firebase SHA-1 setup instructions | `auth_service.dart`. Treat cancel as a no-op. |
| Any backend error during Google/Apple sign-in is treated as "new user" | `auth_service.dart`. Only a 404 should open the setup dialog. |
| Email sign-up creates Firebase before the backend profile, so a failed profile leaves an orphan account | `auth_service.dart`. |
| iOS invites default to TestFlight | `invite_service.dart`. |
| Settings, Profile, and Messages can spin forever or show "empty" when the load failed | `settings_screen.dart`, `profile_screen.dart`, `messages_screen.dart`. |
| Zero `Semantics` widgets in the app | Player, mini player, reactions, drawer. |

## MEDIUM

- Raw exception text in snackbars (about 67 sites). Route through one friendly mapper.
- DJ and Musician cannot be chosen at sign-up; Settings can show "Listener" for those roles.
- Upload screens have no back-guard or cancel (uploads can run up to 45 minutes).
- Camera and mic are requested only after a failure in Go Live and the DJ booth.
- Competition and Analytics swallow failures into empty lists.
- Pro-Networx screens lack pull-to-refresh and retry.
- Files over 1,500 lines: `admin_dashboard_screen.dart`, `player_screen.dart`, `artist_profile_screen.dart`, `studio_screen.dart`, `profile_screen.dart`, and `radio.service.ts` (~4,000 lines).
- All five home pages are built at startup (`IndexedStack`).
- No bottom navigation. Primary destinations are only in the drawer.
- Song marketplace search interpolates raw `q` into a PostgREST filter (`songs.service.ts`).
- No global rate limiter. Public radio presence, force-next, and profile-click are unthrottled.
- 18 controllers use inline `@Body()` types that skip validation.
- Radio "current track" state lives in process memory, so a second Railway replica would diverge. Redis health is checked once at boot.
- No-content radio response has a null audio URL (silence).
- Info.plist declares "Always" location and background `fetch`, which the app does not use.
- `pubspec.yaml` description is still "A new Flutter project." `CFBundleName` is `radio_app`.
- Legal links use `pro-networx.com` while the product domain is `networxradio.com`. Keep both renewed and list the same URLs in App Store Connect and Play Console.
- No CI job that builds the app bundle or IPA.

## LOW

- App version is not shown in Settings.
- "Send test notification" is visible to every user in release builds.
- Retired `payment_screen.dart` still exists. Unused `gem_dashboard_screen.dart` and `butterfly_hero_scene.dart` still pull weight.
- Beta copy is hardcoded in the tutorial and a few paywalls.
- Unknown-route screen prints the internal route name.
- 112 bare `CircularProgressIndicator`s. `shimmer` is installed and unused. Visualizers exist and are not placed on screen. No Hero transitions. Haptics on almost nothing.
- Four overlapping token systems; accent hex values drift (`0xFF00F5FF` vs `0xFF00F0FF`).
- SpaceGrotesk and Lora are bundled and never referenced. `welcome-to-the-networx.png` is 2.6 MB. `mobile/web/icons` are still the default Flutter logo (not in store binaries).
- "No track playing" and the station-offline card use emoji that screen readers read literally.
- About 33 empty states are text-only.

## UI and motion (what Phase 1 changes)

- Bottom `NavigationBar`: Home, Radio, Feed, Discover, Pro or Vote. Drawer stays for secondary pages. Tabs load lazily.
- Mini player: drag up to open, Hero on artwork, animated play/pause, swipe to change station, visualizer under the artwork, one player instance.
- Shared `EmptyState`, `ErrorState`, and shimmer skeletons.
- Global page transitions, haptics helper, token unification on the busiest screens.
- Shared `UserAvatar`, `ArtworkImage`, and `SongTile`.
- Semantics labels on player controls, the mini player, reactions, and the nav bar.

## Phase 2 — growth (not in this release)

- Unified search (songs, artists, users) with `pg_trgm`.
- Real referrals: code, attribution at sign-up, reward of placements or Pro trial days.
- Notification preference center: per-type toggles, quiet hours, weekly digest.
- Engagement-ranked Discover (time decay, demote blocks and reports).
- Sleep timer, CarPlay / Android Auto, home-screen widget, lock-screen Live Activity.
- Weekly artist stats push; plays-by-region and ROI on mobile.
- Offline favorites and listening history.
- Share cards with a deep link. Universal links / App Links.
- Contextual tips instead of the long tutorial.

## Phase 3 — scale (not in this release)

- Radio snapshot and advance lock in Redis so the API can run more than one instance. Periodic Redis health check.
- Last-good playlist cached in Redis, plus a jingle instead of silence when a station has no songs.
- Next track (signed URL) and crossfade metadata on `/radio/current`. Realtime track changes instead of polling.
- Durable scheduled pushes (queue), runtime feature flags, DTOs for the 18 inline bodies.
- CI builds for app bundle and IPA. Playwright smoke on web. Radio selection tests.
- Split the largest screen and service files.

---

## Store submission checklist

Do these in App Store Connect and Play Console. The app changes in this release do not replace them.

### App Store Connect

- [ ] Privacy nutrition labels match the manifest: email, name, user content (audio, video, messages), purchases, coarse location (optional), device ID for push, photos (user-selected).
- [ ] Terms of Use (EULA) URL and Privacy Policy URL are set. Use the same host you put in the app (`pro-networx.com` legal pages today; confirm both domains renew).
- [ ] Sign in with Apple is enabled for the bundle `com.tmaktechnologies.networxradio`.
- [ ] Subscription group products include the introductory offer only if the paywall still claims one. Otherwise the intro line is removed in this release.
- [ ] Demo reviewer account (email + password) with a listener and, if possible, an artist role. Note that radio needs the Supabase project to be active.
- [ ] Age rating questionnaire: user-generated content, unrestricted web only if a WebView can leave the app.
- [ ] Export compliance: `ITSAppUsesNonExemptEncryption` is already `false`.

### Play Console

- [ ] Data safety form matches the labels above.
- [ ] Foreground service declaration: media playback (`AndroidManifest` media playback service).
- [ ] Location permission justification (while-in-use, nearby people / discovery map). Not "always".
- [ ] Target SDK 35 (already forced in Gradle).
- [ ] Upload keystore via `mobile/android/key.properties` (not in git).

### Account actions (cannot be done from the repo)

- [ ] Pay open Supabase invoices and restore project `RADIOapp` (`tgjydsqeatvcerzpdqup`). Turn on auto-pay and billing alerts for Supabase, Vercel, and Railway.
- [ ] Rotate leaked keys: Apple IAP private key, Firebase service account, ACRCloud, ElevenLabs. Then untrack `backend/.env` and `web/.env.vercel.production` and scrub git history.
- [ ] On Railway set `BETA_ALL_FREE=false` and confirm `SENTRY_DSN`. Redeploy latest `main` (production was last brought up from an older successful image).
- [ ] Install JDK 17 and restore `key.properties` so Play bundles can be signed on this Mac.
- [ ] Point an uptime monitor at `GET /api/health` (503 when the database is down, after this release) and at `https://www.networxradio.com`.

### Reviewer notes template

```
NetworX Radio is an internet radio app with listener, artist, and producer accounts.

Sign in: use the demo account in App Review Information, or Sign in with Apple.
Radio plays without an account from the welcome screen.
To review purchases: open the menu, Pro Radio (or Buy plays). Purchases use StoreKit / Play Billing, not an external checkout.
To review user content safety: open a profile or a message, use Report or Block. Settings → Blocked accounts lists blocks. Sign-up requires agreeing to the Terms and Community Guidelines.
Account deletion: Settings → Delete account.
```
