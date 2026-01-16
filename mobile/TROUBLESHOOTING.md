# Troubleshooting Blank Screen

If you're seeing a blank screen when running the app, check the following:

## Common Causes

### 1. Firebase Not Initialized
**Symptoms:** Blank screen, no errors in console

**Fix:**
- Make sure `google-services.json` is in `android/app/`
- Make sure `GoogleService-Info.plist` is in `ios/Runner/`
- Check that Firebase project is set up correctly

**Test:**
```bash
flutter clean
flutter pub get
flutter run
```

### 2. .env File Missing or Incorrect
**Symptoms:** App starts but shows blank screen

**Fix:**
- Create `.env` file in `mobile/` directory
- Add required variables (see SETUP.md)
- Make sure file is not corrupted

### 3. Firebase Initialization Error
**Symptoms:** Blank screen, errors in console

**Check console for:**
- Firebase initialization errors
- Missing Firebase configuration
- Network errors

### 4. StreamBuilder Not Emitting
**Symptoms:** Stuck on loading spinner

**Fix:**
- Check Firebase Auth is enabled in Firebase Console
- Verify internet connection
- Check Firebase rules

## Debug Steps

1. **Check Console Output:**
   ```bash
   flutter run -v
   ```
   Look for errors related to Firebase or initialization

2. **Test Firebase Connection:**
   - Open Firebase Console
   - Check Authentication is enabled
   - Verify project settings

3. **Verify Files Exist:**
   ```bash
   # Check .env file
   Test-Path mobile/.env
   
   # Check Firebase config
   Test-Path mobile/android/app/google-services.json
   Test-Path mobile/ios/Runner/GoogleService-Info.plist
   ```

4. **Try Minimal Test:**
   Temporarily replace `AuthWrapper` with a simple widget to see if the issue is with Firebase:
   ```dart
   // In main.dart, temporarily replace AuthWrapper with:
   home: Scaffold(
     body: Center(child: Text('App is working!')),
   ),
   ```

## Expected Behavior

When app starts, you should see:
1. **Brief loading spinner** (while checking auth)
2. **Login screen** (if not logged in)
3. **Player screen** (if logged in)

If you see a blank screen, there's likely an initialization error that's being silently caught.

## Quick Fix

If nothing else works, try:
```bash
cd mobile
flutter clean
flutter pub get
flutter run
```

And check the console output for any errors.
