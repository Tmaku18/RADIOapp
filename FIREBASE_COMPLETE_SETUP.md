# Complete Firebase Setup Guide

This guide will walk you through setting up Firebase for both the mobile app and backend.

## Prerequisites

- A Google account
- Firebase project (we'll create one)
- Flutter app (already created)
- Backend server (already created)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `radioapp-4c14a` (or your preferred name)
4. Disable Google Analytics (optional, can enable later)
5. Click **"Create project"**
6. Wait for project creation to complete

## Step 2: Set Up Android App

### 2.1 Register Android App

1. In Firebase Console, click the **Android icon** (or "Add app")
2. Enter package name: `com.radioapp.radio_app`
   - This should match `mobile/android/app/build.gradle` → `applicationId`
3. Enter app nickname (optional): "Radio App Android"
4. Enter SHA-1 (optional for now, needed for Google Sign-In later)
5. Click **"Register app"**

### 2.2 Download google-services.json

1. Download the `google-services.json` file
2. Place it in: `mobile/android/app/google-services.json`
   - **Important:** Replace the existing empty file

### 2.3 Configure Android Build

The `build.gradle` files should already be configured, but verify:

**`mobile/android/build.gradle`** should have:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

**`mobile/android/app/build.gradle`** should have at the bottom:
```gradle
apply plugin: 'com.google.gms.google-services'
```

## Step 3: Set Up iOS App

### 3.1 Register iOS App

1. In Firebase Console, click the **iOS icon** (or "Add app")
2. Enter bundle ID: `com.radioapp.radioApp`
   - This should match `mobile/ios/Runner/Info.plist` → `CFBundleIdentifier`
3. Enter app nickname (optional): "Radio App iOS"
4. Enter App Store ID (optional)
5. Click **"Register app"**

### 3.2 Download GoogleService-Info.plist

1. Download the `GoogleService-Info.plist` file
2. Place it in: `mobile/ios/Runner/GoogleService-Info.plist`
   - **Important:** Replace the existing empty file
3. In Xcode, add it to the project (drag and drop into Runner folder)

## Step 4: Enable Authentication Methods

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable the following providers:

### Email/Password
- Click **Email/Password**
- Toggle **Enable**
- Click **Save**

### Google Sign-In
- Click **Google**
- Toggle **Enable**
- Enter support email
- Click **Save**

### Apple Sign-In (iOS only)
- Click **Apple**
- Toggle **Enable**
- Click **Save**

## Step 5: Generate Service Account Key (for Backend)

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Go to **Service Accounts** tab
3. Click **"Generate new private key"**
4. Click **"Generate key"** in the dialog
5. Save the downloaded JSON file
6. **For Backend:** Copy the values to your `backend/.env` file:
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   ```

## Step 6: Configure Flutter App (Option A - FlutterFire CLI - Recommended)

### 6.1 Install FlutterFire CLI
```bash
dart pub global activate flutterfire_cli
```

### 6.2 Configure Firebase
```bash
cd mobile
flutterfire configure
```

This will:
- Ask you to select your Firebase project
- Automatically generate `lib/firebase_options.dart`
- Configure both Android and iOS

### 6.3 Verify
Check that `mobile/lib/firebase_options.dart` was created and has your project details.

## Step 6: Configure Flutter App (Option B - Manual)

If you prefer manual setup:

1. **Update `mobile/lib/firebase_options.dart`** with values from your `google-services.json`:

   From `google-services.json`, find:
   ```json
   {
     "project_info": {
       "project_id": "your-project-id",
       "project_number": "123456789"
     },
     "client": [
       {
         "client_info": {
           "android_client_info": {
             "package_name": "com.radioapp.radio_app"
           }
         },
         "oauth_client": [
           {
             "client_id": "...",
             "client_type": 3
           }
         ],
         "api_key": [
           {
             "current_key": "AIza..."
           }
         ]
       }
     ]
   }
   ```

2. **Update `firebase_options.dart`**:
   ```dart
   static const FirebaseOptions android = FirebaseOptions(
     apiKey: 'AIza...', // from google-services.json
     appId: '1:123456789:android:...', // from google-services.json
     messagingSenderId: '123456789', // project_number
     projectId: 'your-project-id',
     // ... other fields
   );
   ```

## Step 7: Get SHA-1 for Google Sign-In (Android)

For Google Sign-In to work on Android, you need to add your SHA-1 fingerprint:

1. **Get SHA-1:**
   ```bash
   cd mobile/android
   ./gradlew signingReport
   ```
   Or on Windows:
   ```bash
   gradlew.bat signingReport
   ```

2. **Copy the SHA-1** from the output (look for "Variant: debug")

3. **Add to Firebase:**
   - Go to Firebase Console → Project Settings
   - Scroll to "Your apps" → Android app
   - Click "Add fingerprint"
   - Paste SHA-1
   - Click "Save"

## Step 8: Test Firebase Setup

### 8.1 Test Mobile App
```bash
cd mobile
flutter clean
flutter pub get
flutter run
```

**Expected:**
- App starts without Firebase errors
- Login screen appears
- You can see Firebase initialization message in console

### 8.2 Test Authentication
1. Try signing up with email/password
2. Check Firebase Console → Authentication → Users
3. You should see the new user

### 8.3 Test Backend
```bash
cd backend
npm run start:dev
```

**Expected:**
- Server starts without Firebase errors
- Console shows "Firebase initialized successfully"

## Step 9: Environment Variables Summary

### Mobile App (`mobile/.env`)
```env
# Optional - Firebase config is in google-services.json
FIREBASE_API_KEY=your-api-key
FIREBASE_PROJECT_ID=your-project-id
API_BASE_URL=http://localhost:3000
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

### Backend (`backend/.env`)
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
PORT=3000
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

## Troubleshooting

### "No Firebase App '[DEFAULT]' has been created"
- Make sure `google-services.json` is in `mobile/android/app/`
- Make sure `GoogleService-Info.plist` is in `mobile/ios/Runner/`
- Run `flutter clean` and `flutter pub get`
- Check that `firebase_options.dart` has correct values

### "Firebase is not initialized"
- Check console for initialization errors
- Verify Firebase project is active
- Make sure Authentication is enabled in Firebase Console

### Google Sign-In not working
- Add SHA-1 fingerprint to Firebase Console
- Enable Google Sign-In in Authentication settings
- Check that OAuth client is configured

### Backend can't verify tokens
- Verify `FIREBASE_PRIVATE_KEY` in `.env` is correctly formatted (with `\n`)
- Check that service account has proper permissions
- Ensure Firebase Admin SDK is initialized

## Quick Checklist

- [ ] Firebase project created
- [ ] Android app registered and `google-services.json` downloaded
- [ ] iOS app registered and `GoogleService-Info.plist` downloaded
- [ ] Files placed in correct locations
- [ ] Authentication methods enabled (Email, Google, Apple)
- [ ] Service account key generated for backend
- [ ] Backend `.env` configured with Firebase credentials
- [ ] FlutterFire CLI configured OR `firebase_options.dart` manually updated
- [ ] SHA-1 added to Firebase Console (for Google Sign-In)
- [ ] App tested and working

## Next Steps

Once Firebase is set up:
1. Test user registration and login
2. Set up Supabase database
3. Configure Stripe for payments
4. Deploy backend server
5. Test end-to-end flow

## Need Help?

- Firebase Docs: https://firebase.google.com/docs
- FlutterFire Docs: https://firebase.flutter.dev/
- Check `mobile/FIREBASE_SETUP.md` for mobile-specific details
- Check `backend/SETUP_BACKEND.md` for backend setup
