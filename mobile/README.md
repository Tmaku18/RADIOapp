# RadioApp Mobile

Flutter mobile app for the RadioApp radio streaming platform.

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

### For Artists
- Upload songs with audio files and artwork
- Purchase credits via Stripe
- View credit balance and transaction history
- Track song plays and engagement

## Tech Stack

- **Framework**: Flutter 3.x
- **State Management**: Provider
- **Authentication**: Firebase Auth
- **Audio Playback**: just_audio
- **Payments**: flutter_stripe
- **HTTP**: http package
- **Image Caching**: cached_network_image

## Prerequisites

- Flutter SDK 3.0+
- Dart SDK 3.0+
- Android Studio or Xcode
- Firebase project configured
- Backend API running

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
| Profile | View and edit profile | All users |

## Navigation

The app uses bottom navigation:
- **Listeners**: Radio, Profile
- **Artists**: Radio, Upload, Credits, Profile

## Building for Release

### Android
```bash
flutter build appbundle
# or for APK
flutter build apk --release
```

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
