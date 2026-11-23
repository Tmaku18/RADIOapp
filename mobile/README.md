# NETWORX Mobile App

Flutter app for NETWORX Radio and Pro-Networx on iOS and Android. Current version: **1.0.99 (133)** (`version` in `pubspec.yaml`).

## What is included

- Live radio player: multiple stations, server-synced playback, fire / poop votes, 1–10 ratings, report reasons, Live Chat and per-song Comments, synced lyrics, mute that persists across songs and stations, swipe down to close
- Clips and song stories: hold-to-record camera, text and artist-credit stickers, share to Instagram, send in DMs, or post as a story
- Lock screen and Dynamic Island controls (mute + votes), iOS Now Playing widget, Android Auto station list
- Firebase authentication (email/password, Google, Apple), phone text-code verification, and guest browsing
- Discover (swipe, feed posts, artist search with sort and scope), Search, Library, Pro-Radio playlists
- Artist tools: upload, My Songs, albums, buy placements, analytics, Go Live, The Refinery
- Pro-Networx: directory, profiles, services, Studios, job board, DMs with message requests
- Purchases
  - iOS: Apple In-App Purchase (StoreKit) for placements, song / beat sales, subscriptions, Refinery submissions, and tips
  - Android: Google Play Billing for the same products
  - Stripe Payment Sheet where store billing does not apply
- Competition and leaderboards, The Yield, invites
- Push and in-app notifications with deep links; shared links (`https://www.networxradio.com/open/artists/:id`, station and Pro profile links, `networxradio://`) open the app
- Admin screens (moderation, queue, users, DJ Booth) for admin accounts

## Prerequisites

- Flutter 3.38+ (Dart ^3.10; current builds use Flutter 3.44)
- Android Studio with SDK 35 and JDK 17 (Android)
- Xcode with CocoaPods, iOS deployment target 15.0 (iOS)
- Firebase project `radioapp-4c14a` config files
- Backend API available (production or local)

## Setup

1. Install dependencies:

```bash
flutter pub get
```

2. Add Firebase config files (app id `com.tmaktechnologies.networxradio`):
   - Android: `android/app/google-services.json`
   - iOS: `ios/Runner/GoogleService-Info.plist`

3. Create `mobile/.env` from `.env.example`. It is bundled as an asset and read through `lib/core/env.dart`:

```env
API_BASE_URL=https://www.networxradio.com
API_DIRECT_URL=https://backend-production-17cc.up.railway.app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
# Optional: SENTRY_DSN, RADIO_STATION_ID
```

Notes:
- API calls try `API_DIRECT_URL`, then `BACKEND_URL`, then the Railway backend, then `API_BASE_URL`. To use a **local backend**, set both `API_DIRECT_URL` and `API_BASE_URL` to it.
- Android emulator: use `http://10.0.2.2:3000` for the host machine.
- Physical devices: use your machine's LAN IP.

4. Run:

```bash
flutter run
```

## Android identity and Firebase

- Application ID / namespace: `com.tmaktechnologies.networxradio`
- The Firebase Android app must use the same package ID and include your debug, upload, and **Play App Signing** SHA fingerprints. Release builds fail if `google-services.json` is missing the Play App Signing SHA-1.
- Always use the official Firebase-downloaded `google-services.json`.

## Release builds

### Android

```bash
flutter build appbundle --release
```

Build name and number come from `version` in `pubspec.yaml`. Output: `build/app/outputs/bundle/release/app-release.aab`. Checklist: [`../docs/google-play-release-checklist.md`](../docs/google-play-release-checklist.md).

### iOS

```bash
./ios/build_appstore.sh
```

Runs `flutter clean`, `pod install`, and `flutter build ipa` with team `8QZ4S3G53V`, then writes the IPA to `build/ios/ipa/`. Upload with Transporter or Xcode Organizer. Override the version with `BUILD_NAME=… BUILD_NUMBER=…`. Details: [`docs/IOS_APP_STORE.md`](docs/IOS_APP_STORE.md).

### Android signing

1. Copy `android/key.properties.example` to `android/key.properties`.
2. Provide:
   - `storeFile`
   - `storePassword`
   - `keyAlias`
   - `keyPassword`
3. Build release artifacts. Release tasks stop with an error when signing is missing.

## Store product IDs

Product IDs default to the catalog in code (see [`docs/APP_STORE_IAP.md`](docs/APP_STORE_IAP.md) and `backend/src/payments/iap-product-catalog.ts`). Optional Android overrides in `.env`:

- Placements: `ANDROID_PLAY_SONG_PLAYS_{1,3,5,10,25,50,100}_PRODUCT_ID`, `ANDROID_PLAY_SONG_PLAYS_PRICE_PRODUCT_MAP_JSON`
- Credits: `ANDROID_PLAY_CREDITS_{10,25,50,100}_PRODUCT_ID`
- Subscriptions: `ANDROID_PLAY_PRO_RADIO_MONTHLY_PRODUCT_ID`, `ANDROID_PLAY_PRO_NETWORX_MONTHLY_PRODUCT_ID`, `ANDROID_PLAY_PRO_BUNDLE_MONTHLY_PRODUCT_ID`
- Refinery: `ANDROID_PLAY_REFINERY_SUBMISSION_PRODUCT_ID`
- Tips: `ANDROID_PLAY_TIP_{199,499,999,2499}_PRODUCT_ID`

iOS override: `IOS_APP_STORE_SONG_PLAYS_PRICE_PRODUCT_MAP_JSON`.

## Helpful commands

- `flutter analyze`
- `flutter test`
- `flutter test integration_test/app_smoke_test.dart` (device/emulator)
- `flutter devices`
- `flutter run -d <device-id>`

## Testing

```bash
flutter pub get
flutter test
# Optional device smoke:
flutter test integration_test/app_smoke_test.dart
```

CI runs `flutter test`, an Android debug APK build, and an unsigned iOS build. See [`../docs/testing.md`](../docs/testing.md) for the full runbook.

## Related docs

- Parity matrix: `../docs/mobile-web-parity-matrix.md`
- Testing: `../docs/testing.md`
- iOS / IAP / Sign in with Apple: `docs/IOS_APP_STORE.md`, `docs/APP_STORE_IAP.md`, `docs/SIGN_IN_WITH_APPLE.md`
- Troubleshooting: `./TROUBLESHOOTING.md`
