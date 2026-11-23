# Mobile troubleshooting

## Google Sign-In: "ApiException: 10" (DEVELOPER_ERROR)

**Symptoms:** "Google sign in failed: PlatformException(sign_in_failed, ApiException: 10:, ...)"

**Cause:** Your app's **SHA-1 fingerprint** is not registered in Firebase, so Google rejects sign-in.

**Fix:**

1. **Get your SHA-1** (debug keystore):
   ```bash
   # macOS / Linux
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
   ```
   ```powershell
   # Windows
   keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android
   ```
   Or run `./gradlew signingReport` in `mobile/android`. Copy the **SHA1** line.

2. **Add it in Firebase:**
   - Open [Firebase Console](https://console.firebase.google.com) → your project (**radioapp-4c14a**).
   - **Project settings** (gear) → **Your apps**.
   - Select the **Android** app with package name `com.tmaktechnologies.networxradio`.
   - Under **SHA certificate fingerprints**, click **Add fingerprint** and paste your **SHA-1**.
   - Save.

3. **Download updated config:**
   - In the same Android app card, click **Download google-services.json**.
   - Replace `mobile/android/app/google-services.json` with the new file.

4. **Rebuild and run:**
   ```bash
   cd mobile && flutter clean && flutter pub get && flutter run -d <device>
   ```

Add the **upload** keystore SHA-1 and the **Play App Signing** SHA-1 (Play Console → App integrity) as well; release builds stop with an error if the Play App Signing SHA-1 is missing from `google-services.json`.

---

## App talks to production instead of my local backend

The API client tries `API_DIRECT_URL` first, then the Railway backend, then `API_BASE_URL`. Set both `API_DIRECT_URL` and `API_BASE_URL` in `mobile/.env` to your local backend (Android emulator: `http://10.0.2.2:3000`; device: your LAN IP), then fully restart the app (`.env` is bundled at build time, so hot reload does not pick it up).

## Stuck on the phone code screen

Signed-in users must verify a mobile number. With a local backend and no Twilio credentials, the code is printed in the backend log. Each account needs its own number.

---

## Blank screen

If you're seeing a blank screen when running the app, check the following:

## Common Causes

### 1. Firebase Not Initialized
**Symptoms:** Blank screen or the welcome page with sign-in not working

**Fix:**
- Make sure `google-services.json` is in `android/app/`
- Make sure `GoogleService-Info.plist` is in `ios/Runner/`
- Check that `lib/firebase_options.dart` matches the Firebase project

**Test:**
```bash
flutter clean
flutter pub get
flutter run
```

### 2. .env File Missing or Incorrect
**Symptoms:** App starts but cannot load data

**Fix:**
- Create `.env` in `mobile/` from `.env.example`
- It must exist at build time because `pubspec.yaml` bundles it as an asset

### 3. Firebase Initialization Error
**Symptoms:** Errors in console

**Check console for:**
- Firebase initialization errors or "Firebase init timed out" (slow emulator network)
- Missing Firebase configuration
- Network errors

### 4. Stuck on the splash screen
**Symptoms:** Branded loading screen never goes away

**Fix:**
- Check Firebase Auth is enabled in Firebase Console
- Verify internet connection

## Debug Steps

1. **Check Console Output:**
   ```bash
   flutter run -v
   ```
   Look for "Firebase initialized successfully" or errors related to Firebase or initialization

2. **Test Firebase Connection:**
   - Open Firebase Console
   - Check Authentication is enabled
   - Verify project settings

3. **Verify Files Exist:**
   ```bash
   ls mobile/.env mobile/android/app/google-services.json mobile/ios/Runner/GoogleService-Info.plist
   ```

4. **iOS build issues:**
   ```bash
   cd mobile/ios && pod install --repo-update
   ```

## Expected Behavior

When the app starts, you should see:
1. **Branded splash screen** (while checking auth)
2. **Welcome landing page** (if not signed in), with Sign up / Log in and Continue as guest
3. **Phone code screen** (if signed in without a verified number)
4. **Networx Home** (signed in or guest)

## Quick Fix

If nothing else works, try:
```bash
cd mobile
flutter clean
flutter pub get
flutter run
```

And check the console output for any errors.
