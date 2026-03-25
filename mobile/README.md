# RadioApp Mobile

Flutter mobile app for the RadioApp radio streaming platform.

## Web parity matrix

Cross-platform status (web vs Flutter, Android vs iOS) lives in **[docs/mobile-web-parity-matrix.md](../docs/mobile-web-parity-matrix.md)**.

## Overview

The mobile app enables:

- **Listeners**: Stream radio, like songs, create accounts
- **Artists**: Upload music, purchase credits, track plays, manage profile

## Features

### For All Users
- Email/password and Google Sign-In authentication
- Continuous radio streaming with play/pause/skip
- Like/unlike songs
- View current playing track with artwork
- Sign out with loading feedback (via Profile screen)

### For Artists
- Upload songs with audio files and artwork
- **Credits:** Google Play Billing on Android; Stripe (Payment Sheet) on iOS
- Live services (promote gigs) and Support tab (Discord link) — parity with web dashboard
- Add/remove own tracks in **The Refinery** from Studio
- View credit balance and transaction history
- Track song plays and engagement

## Tech Stack

- **Framework**: Flutter 3.38+
- **State Management**: Provider
- **Authentication**: Firebase Auth
- **Audio Playback**: just_audio
- **Payments**: Google Play Billing (Android credits + song plays); flutter_stripe on iOS
- **HTTP**: http package
- **Image Caching**: cached_network_image

## Prerequisites

- Flutter SDK 3.38+
- Dart SDK 3.0+
- Android Studio or Xcode
- Firebase project configured
- Backend API running

## Security

- Never commit `google-services.json` or `GoogleService-Info.plist` to git
- Keep `.env` files local and add to `.gitignore`
- Firebase configuration files are already ignored

## Setup

1. **Install dependencies**:
   ```bash
   flutter pub get
   ```

2. **Configure Firebase**:
   - Run FlutterFire CLI or manually add config files:
     - Android: `android/app/google-services.json`
     - iOS: `ios/Runner/GoogleService-Info.plist`
   - Ensure `lib/firebase_options.dart` exists

3. **Configure API URL**:
   Update the API base URL in `lib/core/services/api_service.dart`

4. **Configure Stripe** (for payments):
   Set your Stripe publishable key in `lib/main.dart`

5. **Run the app**:
   ```bash
   # Debug mode
   flutter run

   # Release mode
   flutter run --release
   ```

## Project Structure

```
mobile/
├── lib/
│   ├── core/
│   │   ├── auth/
│   │   │   └── auth_service.dart    # Firebase Auth wrapper
│   │   ├── models/
│   │   │   ├── song.dart            # Song model
│   │   │   └── user.dart            # User model
│   │   └── services/
│   │       ├── api_service.dart     # HTTP client
│   │       └── radio_service.dart   # Radio playback
│   ├── features/
│   │   ├── credits/
│   │   │   └── credits_screen.dart  # Credit balance & history
│   │   ├── payment/
│   │   │   └── payment_screen.dart  # Credit purchase
│   │   ├── player/
│   │   │   └── player_screen.dart   # Radio player
│   │   ├── profile/
│   │   │   └── profile_screen.dart  # User profile
│   │   └── upload/
│   │       └── upload_screen.dart   # Song upload
│   ├── widgets/
│   │   ├── home_screen.dart         # Main navigation
│   │   └── login_screen.dart        # Auth UI
│   ├── firebase_options.dart        # Firebase config
│   └── main.dart                    # App entry point
├── android/                         # Android project
├── ios/                             # iOS project
├── pubspec.yaml                     # Dependencies
└── README.md
```

## Screens

| Screen | Description | Access |
|--------|-------------|--------|
| Login | Email/password, Google Sign-In | Public |
| Player | Radio streaming, play/pause/skip, like | All users |
| Upload | Upload audio and artwork | Artists only |
| Credits | View balance and transactions | Artists only |
| Payment | Purchase credit packages | Artists only |
| Profile | View and edit profile, sign out | All users |

## Navigation

The app uses bottom navigation:
- **Listeners**: Radio, Profile
- **Artists**: Radio, Upload, Credits, Profile

## Building for Release

### Android
```bash
flutter build appbundle --release --build-number <incremented_number>
# or for APK
flutter build apk --release
```

#### Android release signing (required for Play Console)

1. Generate an upload keystore (example):
   ```bash
   keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
2. Place the keystore at `mobile/upload-keystore.jks` (or another local path).
3. Copy `mobile/android/key.properties.example` to `mobile/android/key.properties`.
4. Fill in `storeFile`, `storePassword`, `keyAlias`, `keyPassword` in `key.properties`.
5. Build with:
   ```bash
   flutter build appbundle --release --build-number <incremented_number>
   ```
6. In Google Play Console first upload, enable **Play App Signing** and keep your upload key credentials secure.

#### Android Google Play Billing product IDs

Android purchases now use Google Play Billing. Configure these optional `.env` keys
if your Play product IDs differ from defaults:

- `ANDROID_PLAY_CREDITS_10_PRODUCT_ID` (default: `nwx_credits_10`)
- `ANDROID_PLAY_CREDITS_25_PRODUCT_ID` (default: `nwx_credits_25`)
- `ANDROID_PLAY_CREDITS_50_PRODUCT_ID` (default: `nwx_credits_50`)
- `ANDROID_PLAY_CREDITS_100_PRODUCT_ID` (default: `nwx_credits_100`)
- `ANDROID_PLAY_SONG_PLAYS_1_PRODUCT_ID` (default: `nwx_song_plays_1`)
- `ANDROID_PLAY_SONG_PLAYS_3_PRODUCT_ID` (default: `nwx_song_plays_3`)
- `ANDROID_PLAY_SONG_PLAYS_5_PRODUCT_ID` (default: `nwx_song_plays_5`)
- `ANDROID_PLAY_SONG_PLAYS_10_PRODUCT_ID` (default: `nwx_song_plays_10`)
- `ANDROID_PLAY_SONG_PLAYS_25_PRODUCT_ID` (default: `nwx_song_plays_25`)
- `ANDROID_PLAY_SONG_PLAYS_50_PRODUCT_ID` (default: `nwx_song_plays_50`)
- `ANDROID_PLAY_SONG_PLAYS_100_PRODUCT_ID` (default: `nwx_song_plays_100`)

For exact per-song pricing (`$1/minute per play`) use dynamic song-play mapping:

- `ANDROID_PLAY_SONG_PLAYS_PRICE_PRODUCT_MAP_JSON`

Example:

```json
{
  "5:1500": "nwx_song_plays_5_1500",
  "10:3000": "nwx_song_plays_10_3000"
}
```

Each key is `<plays>:<totalCents>`, where `totalCents` comes from backend song pricing
(`GET /payments/song-play-price?songId=...`).

### iOS
```bash
flutter build ios --release
```

## Available Commands

- `flutter run` - Run in debug mode
- `flutter build apk` - Build Android APK
- `flutter build appbundle` - Build Android App Bundle
- `flutter build ios` - Build iOS app
- `flutter test` - Run tests
- `flutter analyze` - Analyze code

## Dependencies

Key packages used:
- `firebase_auth` - Authentication
- `firebase_core` - Firebase initialization
- `just_audio` - Audio playback
- `flutter_stripe` - Stripe payments
- `provider` - State management
- `cached_network_image` - Image caching
- `file_picker` - File selection
- `image_picker` - Image selection
