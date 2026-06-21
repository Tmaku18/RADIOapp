# Google Sign-In on Play Store (Android)

## Why emulator works but Play Store does not

| Build | Signing key | SHA-1 registered in Firebase |
|-------|-------------|------------------------------|
| Emulator / `flutter run` | Debug keystore | Debug SHA-1 |
| Play Store (internal/production) | **Play App Signing** key | **App signing certificate** SHA-1 |

These are **different fingerprints**. Google Sign-In rejects the Play build if only the debug SHA-1 is registered.

## Required Firebase setup

1. Open [Firebase Console](https://console.firebase.google.com) → **radioapp-4c14a** → Project settings → Your apps.
2. Select Android app **`com.tmaktechnologies.networxradio`**.
3. Under **SHA certificate fingerprints**, ensure **both** are present:
   - **Debug** (local dev): `2B:A4:EF:54:A5:E1:1C:4C:31:2F:4B:8D:89:59:56:9C:B2:60:43:C2`
   - **Play App Signing** (Play Store): `19:BE:18:3C:57:9A:BF:10:DC:7C:3B:8F:4A:03:2A:B4:AB:E1:2A:7F`
4. Add **SHA-256** for the Play App Signing cert as well (Play Console → App integrity → App signing key certificate).
5. Download **`google-services.json`** and place at `mobile/android/app/google-services.json`.
6. Rebuild and upload a **new** AAB (build number must increase).

Play Console path for SHA-1/256: **Release → Setup → App integrity → App signing key certificate**.

## OAuth consent screen (Testing mode)

If the Google Cloud OAuth app is still in **Testing**, only emails listed under **Test users** can sign in. Add every tester Gmail:

Google Cloud Console → **APIs & Services** → **OAuth consent screen** → **Test users**.

Publishing the OAuth app to **Production** removes this restriction (may require verification for sensitive scopes).

## Release build guard

Release Gradle config fails the build if `google-services.json` is missing or does not contain the Play App Signing SHA-1 hash. This prevents shipping an AAB that can only sign in on debug builds.

## Upload checklist

```powershell
cd mobile
flutter pub get
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab
```

Upload to Play **Internal testing**, install from the Play Store link (not sideload), then test Google Sign-In.
