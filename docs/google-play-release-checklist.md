# Google Play Release Checklist (Android)

This checklist is for NETWORX Android releases uploaded to Google Play.

## 1) Bump app version and build number

- Source of truth: `mobile/pubspec.yaml` (currently `version: 1.0.99+133`).
- Android `versionCode` is the number after `+`. iOS and Android share this file, so one bump covers both stores.
- Every Play upload must use a strictly higher build number than the previous upload.

Example:

```bash
# Inspect current version in pubspec.yaml
rg "^version:" mobile/pubspec.yaml

# Build AAB from pubspec, or override the build number (example: 134)
cd mobile
flutter build appbundle --release
flutter build appbundle --release --build-number 134
# Output: build/app/outputs/bundle/release/app-release.aab
```

## 2) Verify signing setup

- Ensure `mobile/android/key.properties` exists (local only, never committed) with `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`.
- Ensure the upload keystore that `storeFile` points to exists locally (never committed).
- The release build fails if any release signing value is missing.
- The release build also fails if `mobile/android/app/google-services.json` is missing or lacks the Play App Signing SHA-1. See [google-play-google-signin.md](./google-play-google-signin.md).

## 3) Verify target API requirement

- `mobile/android/app/build.gradle.kts` sets `targetSdk` and `compileSdk` to at least 35.
- Confirm generated bundle was built from current branch and release commit.

## 4) Internal testing track before production

- Upload AAB to **Internal testing** first and install from the Play link (not sideloaded).
- Verify Google/Apple/email sign-in, text-code verification, Continue as guest, radio playback and background playback, notifications, the location prompt on Nearby, camera and microphone on clip recording and Live DJ, and store purchases.
- Verify song, artist, and radio links on `www.networxradio.com` open the app (App Links).
- Spot-check items in [android-14-15-smoke-test.md](./android-14-15-smoke-test.md) and [web_mobile_parity_matrix.md](../mobile/docs/web_mobile_parity_matrix.md).

## 5) Play Console app content/disclosures

- Data safety form updated to match current app behavior ([google-play-app-content-packet.md](./google-play-app-content-packet.md)).
- Ads declaration: **No ads**. The manifest removes `AD_ID`.
- Privacy policy URL points to public HTTPS page.
- Permissions declarations (notifications, location, foreground media playback, camera, microphone) are complete and accurate.
- Content rating questionnaire reflects creator-uploaded music and explicit content possibilities.
- Target audience settings remain consistent with app age suitability.
- Account deletion URL: `https://www.networxradio.com/delete-account`.
- Support contact details match `support@networxradio.com`.
- Cross-check all disclosures against `docs/legal/mobile-store-compliance-packet.md`.

## 6) Promote to production

- Confirm no policy warnings remain in Play Console.
- Roll out production with staged rollout if needed.
- Save final reviewer notes and screenshots used during submission in release records.
