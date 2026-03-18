# Google Play Release Checklist (Android)

This checklist is for NETWORX Android releases uploaded to Google Play.

## 1) Bump app version and build number

- Source of truth: `mobile/pubspec.yaml`
- Android `versionCode` maps to Flutter `build-number` (`--build-number`).
- Every Play upload must use a strictly higher build number than the previous upload.

Example:

```bash
# Inspect current version in pubspec.yaml
rg "^version:" mobile/pubspec.yaml

# Build AAB with incremented build number (example: 42)
cd mobile
flutter build appbundle --release --build-number 42
```

## 2) Verify signing setup

- Ensure `mobile/android/key.properties` exists (local only, never committed).
- Ensure `mobile/upload-keystore.jks` exists (local only, never committed).
- Build must fail if release signing values are missing.

## 3) Verify target API requirement

- Build config enforces `targetSdk >= 35`.
- Confirm generated bundle was built from current branch and release commit.

## 4) Internal testing track before production

- Upload AAB to **Internal testing** first.
- Verify login, playback, notifications, location prompts, and purchase flows.

## 5) Play Console app content/disclosures

- Data safety form updated to match current app behavior.
- Ads declaration set correctly.
- Privacy policy URL points to public HTTPS page.
- Permissions declarations (notifications/location/foreground service) are complete and accurate.

## 6) Promote to production

- Confirm no policy warnings remain in Play Console.
- Roll out production with staged rollout if needed.
