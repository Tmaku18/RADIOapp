# NETWORX Mobile App

Flutter mobile application for NETWORX live radio, artist tools, and competition features.

## What is included

- Live radio player with heartbeat/presence tracking and per-play voting (fire/shit)
- Firebase authentication (email/password, Google, Apple)
- Artist upload and studio tools
- Credits and purchases
  - Android: Google Play Billing
  - iOS: Stripe Payment Sheet (`flutter_stripe`)
- Competition and spotlight screens with live leaderboard tabs:
  - likes, discoveries, positive votes, best ratio, saves, trial by fire
- Notifications and deep-link routing into player/analytics/live watch flows

## Prerequisites

- Flutter 3.38+
- Dart 3+
- Android Studio and/or Xcode
- Firebase project configured
- Backend API available

## Setup

1. Install dependencies:

```bash
flutter pub get
```

2. Add Firebase config files:
   - Android: `android/app/google-services.json`
   - iOS: `ios/Runner/GoogleService-Info.plist`

3. Create `mobile/.env` with values used by `lib/core/env.dart` and `lib/main.dart`, for example:

```env
API_BASE_URL=http://10.0.2.2:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

Notes:
- Android emulator should use `10.0.2.2` for host localhost.
- Physical devices should use your machine LAN IP.

4. Run:

```bash
flutter run
```

## Android identity and Firebase

- Current Android application ID / namespace:
  - `com.discovermeradio.networxradio`
- Ensure your Firebase Android app uses the same package ID and includes your debug/release SHA fingerprints.
- Always use the official Firebase-downloaded `google-services.json` for that app ID.

## Release builds

### Android

```bash
flutter build appbundle --release --build-number <incremented_number>
flutter build apk --release
```

### iOS

```bash
flutter build ios --release
```

### Android signing

1. Create/update `mobile/android/key.properties`.
2. Provide:
   - `storeFile`
   - `storePassword`
   - `keyAlias`
   - `keyPassword`
3. Build release artifacts.

## Billing product IDs (Android)

If Play product IDs differ from defaults, configure `.env` keys:

- `ANDROID_PLAY_CREDITS_10_PRODUCT_ID`
- `ANDROID_PLAY_CREDITS_25_PRODUCT_ID`
- `ANDROID_PLAY_CREDITS_50_PRODUCT_ID`
- `ANDROID_PLAY_CREDITS_100_PRODUCT_ID`
- `ANDROID_PLAY_SONG_PLAYS_1_PRODUCT_ID`
- `ANDROID_PLAY_SONG_PLAYS_3_PRODUCT_ID`
- `ANDROID_PLAY_SONG_PLAYS_5_PRODUCT_ID`
- `ANDROID_PLAY_SONG_PLAYS_10_PRODUCT_ID`
- `ANDROID_PLAY_SONG_PLAYS_25_PRODUCT_ID`
- `ANDROID_PLAY_SONG_PLAYS_50_PRODUCT_ID`
- `ANDROID_PLAY_SONG_PLAYS_100_PRODUCT_ID`
- Optional dynamic map: `ANDROID_PLAY_SONG_PLAYS_PRICE_PRODUCT_MAP_JSON`

## Helpful commands

- `flutter analyze`
- `flutter test`
- `flutter devices`
- `flutter run -d <device-id>`

## Related docs

- Parity matrix: `../docs/mobile-web-parity-matrix.md`
- Troubleshooting: `./TROUBLESHOOTING.md`
