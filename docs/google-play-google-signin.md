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
   - **Play App Signing** (Play Store): `ED:16:9D:AB:9D:CE:88:5F:08:E5:AD:1D:EB:41:C9:ED:E4:AC:1C:88`
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

## Error `[16] Account reauth failed`

This appears after picking a Google account when the **Android OAuth client** does not match the **signing key** of the installed APK, or when **Credential Manager** fails on the device.

### Checklist

1. **How did you install the app?**
   - **Play Store / Internal testing** → Firebase must include **App signing** SHA-1: `ED:16:9D:AB:9D:CE:88:5F:08:E5:AD:1D:EB:41:C9:ED:E4:AC:1C:88` (and SHA-256 from Play Console → App integrity).
   - **Sideloaded release APK** → also add your **upload-key** SHA-1 (`e3:B8:59:…` in current `google-services.json`).
   - **Debug / `flutter run`** → debug SHA-1: `2B:A4:EF:54:…`

2. **OAuth consent screen (Testing mode)**  
   Google Cloud → **APIs & Services** → **OAuth consent screen** → **Test users** → add every Gmail you sign in with (e.g. `tmaku12430@gmail.com`).  
   Or publish the OAuth app to **Production**.

3. **Re-download config**  
   After adding fingerprints in Firebase, download a fresh `google-services.json` and rebuild (build number must increase).

4. **On the phone**  
   Settings → Apps → **Google Play services** → Storage → **Clear cache**, then retry.

5. **Build 14+**  
   Stops hardcoding the Play OAuth client on Android (auto-selects from `google-services.json`) and disables Credential Manager as a fallback for `[16]`.

## Upload checklist

```powershell
cd mobile
flutter pub get
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab
```

Upload to Play **Internal testing**, install from the Play Store link (not sideload), then test Google Sign-In.
