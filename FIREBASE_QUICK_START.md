# Firebase Quick Start Guide

## What You Need to Set Up Firebase

### For Mobile App (Flutter)

1. **Firebase Project** ✅ (You already have: `radioapp-4c14a`)
2. **google-services.json** for Android
3. **GoogleService-Info.plist** for iOS  
4. **firebase_options.dart** (auto-generated or manual)
5. **Enable Authentication** in Firebase Console

### For Backend (NestJS)

1. **Service Account Key** ✅ (You already have the JSON file)
2. **Environment variables** in `backend/.env`

---

## Step-by-Step Setup

### Step 1: Get Configuration Files from Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **radioapp-4c14a**

#### For Android:
1. Click **⚙️ Project Settings** (gear icon)
2. Scroll to **"Your apps"** section
3. Find your **Android app** or click **"Add app"** → Android
4. Download **google-services.json**
5. Place it in: `mobile/android/app/google-services.json` (replace existing)

#### For iOS:
1. Same Project Settings page
2. Find your **iOS app** or click **"Add app"** → iOS
3. Download **GoogleService-Info.plist**
4. Place it in: `mobile/ios/Runner/GoogleService-Info.plist` (replace existing)

### Step 2: Configure Flutter App (Easiest Method)

```bash
# Install FlutterFire CLI
dart pub global activate flutterfire_cli

# Navigate to mobile directory
cd mobile

# Run configuration (will ask you to select your Firebase project)
flutterfire configure
```

This automatically:
- Generates `lib/firebase_options.dart`
- Configures both Android and iOS
- Sets up everything you need

### Step 3: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable:
   - ✅ **Email/Password** (toggle on, save)
   - ✅ **Google** (toggle on, enter support email, save)
   - ✅ **Apple** (optional, for iOS)

### Step 4: Configure Backend

You already have the service account JSON. Extract values to `backend/.env`:

From your `backend/config/firebase-service-account.json.json`:

```env
FIREBASE_PROJECT_ID=radioapp-4c14a
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDTtNMeAdqI2dw7\nTN59QTzJf8c3UMSfMIiVTVLj9HD8noMJa5zri+2MEQxhy+0Z1lRRZ2qfDLfEu4vO\nGXvfi193s48NQMFJKURoXdr0k4C7hFXI2s2ookqdHWRikSmSdET0KINv5O77Usrb\nPjQE18P/PljhlMKpHsh3cpjBqnzHH80J72xmi9iOu8GsH1KlJted6nMxq/iOakM9\nG6xoPuup59j9YNeb346LD1uzWkwc88eVGfwzOIZOJ3SylpCjCuJp11Qd+MtObZjr\nTyXGIPQohmpridUdsLD+GIq6HIOb6279gi5cdYJ2SLm8jnrxeUMeJH8AJjSsHg+6\nvs3/SDmhAgMBAAECggEAEZvJr4ZB8f4E5l3HZ62ka7IYFM6/++migqCS02kCeNCK\nX582xxS1ZmAIop2+k9aS3s52PNJm+pMK1tKhzf8eqqshq92F9hrbmL6ttogKPg6M\nwA8K6grNn/HQ5q3iQk8vaQtxmz30bqz9OG0dEIYNxE4gQGsKIdzwmZbLg9g1Vq50\ntYbnq21sxp5wLnphdbxrJG+AO23xp5UO5pBTlAKulcMiGaSfHIKBsm7DTCJ10ErK\ney2bvr7C974OoKsJOn23rzkDrJGn8VsUIKf0SB/LBFh3+t+2/heBeSakXhGflNzw\nVF2bXPTXbCqdCGNJBQhmyWpwS8I3z+As2TZuWwx9XQKBgQDwKhyR2j1quXxMKUzz\n4Saf0LcIAfskLmVaKo6UXDDFeOpAPW/2SLlOZ+qgp8Dh4mdbYAwi7dZ+jD7APoqw\nBAaQNiTJuyqVqnAh8gDkPKLdYhjIKSdW64xaZVGiZ3wfZ+ZeUtKuWeSrP7L19Jdm\nUzjachLwS1pOEM7oaGdcWDH0WwKBgQDhqlmVctj2fusTCCAxNIgvHr8y4UC5EHnT\n6NYpvJSIIxpAR8YDgiGXZiOpxHXdoWr+vGZVDRivrTJfskoP+6HUY3lL5YmSQLUe\nIXS46mAekImz8tegiRh6EhRHlDxH6Ho7G5bzX699gwpd3pY4z/dvfZBTkcjGPoJb\nbu3vumV6swKBgEfp1DQ4TTuv3vBPTaOZP5+LN8NGFJV47xBYveje0hvPYRVrUCNH\nE3XO2ArTMIZy7NAHqpqq7Rdnl0Kpd43NJsn37Hwbd1zpdDo15N5y6bGwtgr5h7YX\nQievPwqKQjiFPA3ybvOWJ0rAAC511v/k25lNny4k4h2OGuasnIaiQhMRAoGAdK8f\nuS30T6iapnGaK7cs/6hXVtiwHcEOLWuEaXpQFwCHj1tNYP0Fn4I5yIuEIoBXkbYa\n97lY3WWh2WeX8iG7sNVqn7rlYpFA1X6ZGxBdeRBlk31qz2B0HpKAl+5nKQtlQHDo\noZkFZdG/J4BzjpbCK4zydrO37AHgZ6S5NS7dUA8CgYBeE7EI7MQryrsAn8GyBIXz\n4XxNdGJb/kUDuooMLBNukaE1GmSpH319nsDtHunUnkVZ7XMLC7Mib2rRExgdVrjm\nRjy69D95U/3aa2HKtaYsyChz73nJkmJ2Yu30mwa9LT2ICJzuRK0D1lhCXEzm5Z3J\nOgEjmMtk+2AdU1/3wY5mBw==\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@radioapp-4c14a.iam.gserviceaccount.com
```

**Important:** The private key must be on ONE line with `\n` characters, wrapped in double quotes.

### Step 5: Verify Setup

#### Test Mobile App:
```bash
cd mobile
flutter clean
flutter pub get
flutter run
```

**Look for in console:**
- ✅ "Firebase initialized successfully"
- ✅ Login screen appears
- ❌ No "No Firebase App" errors

#### Test Backend:
```bash
cd backend
npm run start:dev
```

**Look for in console:**
- ✅ "Firebase initialized successfully"
- ✅ "Application is running on: http://localhost:3000"

### Step 6: Test Authentication

1. Run the mobile app
2. Try to sign up with email/password
3. Check Firebase Console → Authentication → Users
4. You should see the new user created

---

## Quick Checklist

- [ ] Firebase project exists (✅ You have: radioapp-4c14a)
- [ ] `google-services.json` downloaded and placed in `mobile/android/app/`
- [ ] `GoogleService-Info.plist` downloaded and placed in `mobile/ios/Runner/`
- [ ] Run `flutterfire configure` OR manually update `firebase_options.dart`
- [ ] Authentication enabled in Firebase Console (Email, Google, Apple)
- [ ] Backend `.env` has Firebase credentials
- [ ] Tested mobile app - no Firebase errors
- [ ] Tested backend - Firebase initializes
- [ ] Can create user account

---

## If You Get Stuck

### "No Firebase App '[DEFAULT]' has been created"
→ Make sure `google-services.json` is in the right place and not empty

### "Firebase is not initialized"
→ Run `flutterfire configure` or check `firebase_options.dart`

### Backend can't verify tokens
→ Check `FIREBASE_PRIVATE_KEY` format in `.env` (must have `\n` characters)

### Google Sign-In not working
→ Add SHA-1 fingerprint to Firebase Console (see full guide)

---

## Files You Should Have

```
mobile/
  android/app/google-services.json          ← Download from Firebase
  ios/Runner/GoogleService-Info.plist       ← Download from Firebase
  lib/firebase_options.dart                 ← Generated by flutterfire configure

backend/
  .env                                      ← Add Firebase credentials here
  config/firebase-service-account.json.json ← You already have this
```

---

## Next Steps After Firebase Setup

1. Set up Supabase database
2. Configure Stripe for payments
3. Test full authentication flow
4. Deploy backend server

See `FIREBASE_COMPLETE_SETUP.md` for detailed instructions.
