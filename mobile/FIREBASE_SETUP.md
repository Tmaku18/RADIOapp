# Firebase Setup Guide

## The Error: "No Firebase App '[DEFAULT]' has been created"

This error occurs when Firebase isn't properly configured. Here's how to fix it:

## Option 1: Use FlutterFire CLI (Recommended)

1. **Install FlutterFire CLI:**
   ```bash
   dart pub global activate flutterfire_cli
   ```

2. **Configure Firebase:**
   ```bash
   cd mobile
   flutterfire configure
   ```
   
   This will:
   - Ask you to select your Firebase project
   - Generate `firebase_options.dart` automatically
   - Configure both Android and iOS

3. **Update main.dart:**
   The code is already set up to use `DefaultFirebaseOptions.currentPlatform`

## Option 2: Manual Setup

### For Android:

1. **Get google-services.json:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project
   - Go to Project Settings (gear icon)
   - Scroll to "Your apps"
   - Click on Android app or "Add app" if none exists
   - Download `google-services.json`

2. **Place the file:**
   ```
   mobile/android/app/google-services.json
   ```

3. **Update firebase_options.dart:**
   Open `mobile/lib/firebase_options.dart` and fill in the values from your `google-services.json`:
   ```dart
   static const FirebaseOptions android = FirebaseOptions(
     apiKey: 'AIza...', // from google-services.json
     appId: '1:...',    // from google-services.json
     messagingSenderId: '...', // from google-services.json
     projectId: '...',  // from google-services.json
   );
   ```

### For iOS:

1. **Get GoogleService-Info.plist:**
   - Same Firebase Console
   - Select iOS app
   - Download `GoogleService-Info.plist`

2. **Place the file:**
   ```
   mobile/ios/Runner/GoogleService-Info.plist
   ```

3. **Update firebase_options.dart:**
   Fill in iOS values from your plist file.

## Option 3: Quick Test (Without Firebase)

If you just want to test the app UI without Firebase:

1. The app will now handle missing Firebase gracefully
2. You'll see the login screen but authentication won't work
3. This is useful for UI testing only

## Verify Setup

After setting up Firebase:

1. **Clean and rebuild:**
   ```bash
   cd mobile
   flutter clean
   flutter pub get
   flutter run
   ```

2. **Check console:**
   You should see: "Firebase initialized successfully"

3. **Test authentication:**
   Try signing in - it should work now!

## Troubleshooting

### Still getting the error?

1. **Check files exist:**
   ```bash
   # Android
   Test-Path mobile/android/app/google-services.json
   
   # iOS
   Test-Path mobile/ios/Runner/GoogleService-Info.plist
   ```

2. **Check file contents:**
   Make sure the JSON/plist files are not empty and contain valid Firebase config

3. **Rebuild:**
   ```bash
   flutter clean
   flutter pub get
   flutter run
   ```

4. **Check Firebase project:**
   - Make sure your Firebase project exists
   - Verify Authentication is enabled
   - Check that the app is registered in Firebase Console

## Next Steps

Once Firebase is configured:
1. Enable Authentication methods in Firebase Console (Email/Password, Google, etc.)
2. Set up your backend with Firebase Admin SDK
3. Test the authentication flow
