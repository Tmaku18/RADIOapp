# iOS App Store build (Networx Radio)

## Hard requirement

App Store / TestFlight builds **must be created on macOS with Xcode**.  
This Windows machine cannot produce a signed `.ipa`.

Use a Mac, MacinCloud, GitHub-hosted macOS runner, or Codemagic.

## Project settings (already applied in repo)

| Setting | Value |
|---------|--------|
| Bundle ID | `com.tmaktechnologies.networxradio` |
| Team ID | `8QZ4S3G53V` |
| Display name | Networx Radio |
| Version (pubspec) | `1.0.15+31` — bump build number for each upload |
| Export options | `ios/ExportOptions.plist` (app-store-connect) |
| Build script | `ios/build_appstore.sh` |

## Before first build (checklist)

1. **App ID** registered in Apple Developer: `com.tmaktechnologies.networxradio`  
   Capabilities: Push Notifications, Sign In with Apple, In-App Purchase.
2. **App** created in App Store Connect with that Bundle ID.
3. **Firebase iOS app** with the same Bundle ID → download `GoogleService-Info.plist` → place at:
   `mobile/ios/Runner/GoogleService-Info.plist`
4. On the Mac: Xcode → Settings → Accounts → add your Apple ID → select team **8QZ4S3G53V**.
5. Open `ios/Runner.xcworkspace` once, select **Runner** target → Signing & Capabilities → confirm Automatic signing + team.

## Build + upload (on a Mac)

```bash
cd RADIOapp/mobile
chmod +x ios/build_appstore.sh
BUILD_NAME=1.0.15 BUILD_NUMBER=32 ./ios/build_appstore.sh
```

Or manually:

```bash
cd RADIOapp/mobile
flutter clean
flutter pub get
cd ios ; pod install --repo-update ; cd ..
flutter build ipa --release --build-name=1.0.15 --build-number=32 \
  --export-options-plist=ios/ExportOptions.plist
```

Then upload the IPA from `build/ios/ipa/*.ipa` via:

- **Transporter** (easiest), or  
- Xcode → **Organizer** → Distribute App → App Store Connect

## After upload

1. App Store Connect → **TestFlight** → wait for processing (often 5–30 min).  
2. Add compliance / export answers if prompted.  
3. Invite internal testers, then submit for App Review when ready.

## Common blockers

| Error | Fix |
|-------|-----|
| No matching provisioning profile | Open Xcode, enable Automatic signing for Runner |
| Bundle ID mismatch | Must be `com.tmaktechnologies.networxradio` everywhere |
| Missing GoogleService-Info.plist | Add Firebase iOS app + plist before release builds |
| Invalid Swift / CocoaPods | `cd ios ; pod install --repo-update` |
| Build number already used | Increment `BUILD_NUMBER` (must be unique and increasing) |
