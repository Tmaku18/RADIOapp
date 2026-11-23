# Networx Radio — iOS App Store upload (from scratch on a Mac)

Use this on a **Mac** with your Apple Developer account (**Team ID `8QZ4S3G53V`**).

| Setting | Value |
|---------|--------|
| App name | Networx Radio |
| Bundle ID | `com.tmaktechnologies.networxradio` |
| Widget extension bundle ID | `com.tmaktechnologies.networxradio.NowPlayingWidget` |
| App Group | `group.com.tmaktechnologies.networxradio` |
| Team ID | `8QZ4S3G53V` |
| Version | From `mobile/pubspec.yaml` — currently `1.0.99+133` (marketing version `1.0.99`, build `133`) |
| Build number rule | Must be higher than every build already in App Store Connect. iOS and Android share the number in `pubspec.yaml`. |
| Minimum iOS | 15.0 (widget extension 16.2) |
| Repo path (on Mac) | `RADIOapp/mobile` |

---

## Part A — One-time Apple / Firebase setup

Skip any step you already finished.

### A1. Apple Developer — App IDs

1. Open [developer.apple.com/account](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**.
2. **Identifiers** → **+** → **App IDs** → **App** → Continue.
3. Fill in:
   - **Description:** `Networx Radio`
   - **Bundle ID:** Explicit → `com.tmaktechnologies.networxradio`
4. On **Capabilities**, enable:
   - **Push Notifications**
   - **Sign In with Apple** → Configure → Primary App ID → Save
   - **In-App Purchase** (product + server setup: [`APP_STORE_IAP.md`](./APP_STORE_IAP.md))
   - **App Groups** → `group.com.tmaktechnologies.networxradio`
   - **Associated Domains** (Universal Links for `www.networxradio.com` and `networxradio.com`)
5. **App Services** and **Capability Requests:** leave empty / no requests.
6. Continue → Register.
7. The Now Playing widget (lock screen / Dynamic Island Live Activity) needs its own App ID, `com.tmaktechnologies.networxradio.NowPlayingWidget`, with **App Groups** → `group.com.tmaktechnologies.networxradio`. Automatic signing in Xcode usually registers it on the first archive; confirm it exists if signing fails.

### A2. App Store Connect — create the app

1. Open [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps** → **+** → **New App**.
2. Fill in:
   - **Platforms:** iOS
   - **Name:** `Networx Radio`
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** `com.tmaktechnologies.networxradio`
   - **SKU:** `com.tmaktechnologies.networxradio`
   - **User Access:** Full Access
3. Click **Create**.

### A3. Firebase iOS app (already done in repo)

Confirm Firebase Console → project **radioapp-4c14a** has an iOS app with bundle ID `com.tmaktechnologies.networxradio`.

`mobile/ios/Runner/GoogleService-Info.plist` is tracked in this private repo. If it is missing, download it from Firebase Console → Project settings → Your apps → iOS. Without it, Firebase Messaging / Auth will not initialize correctly.

### A4. APNs key for push

1. Apple Developer → **Keys** → **+**.
2. Name: `Networx APNs`.
3. Enable **Apple Push Notifications service (APNs)** → Continue → Register.
4. Download the `.p8` once; note **Key ID** and Team ID `8QZ4S3G53V`.
5. Firebase Console → Project settings → **Cloud Messaging** → iOS → upload the APNs key.

Without this, builds still upload, but push notifications on iOS will not work.

---

## Part B — Mac machine setup (first time)

### B1. Install Xcode

1. Mac App Store → install **Xcode** (latest stable) at `/Applications/Xcode.app`.
2. Open Xcode once; accept license.
3. Xcode → **Settings** → **Locations** → Command Line Tools = your Xcode version.
4. Terminal:

```bash
sudo xcodebuild -license accept
xcode-select -p
# should print something like /Applications/Xcode.app/Contents/Developer
```

### B2. Sign into Apple in Xcode

1. Xcode → **Settings** → **Accounts**.
2. **+** → Apple ID → sign in with the account that owns team **8QZ4S3G53V**.
3. Select the team → **Manage Certificates** → ensure you have an **Apple Distribution** certificate (Xcode can create it automatically).

### B3. Install Homebrew (if missing)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the “Next steps” it prints to add `brew` to your PATH.

### B4. Install Flutter, CocoaPods, Git, Transporter

```bash
brew install git cocoapods
brew install --cask flutter
brew install --cask transporter
flutter doctor
```

The app is currently built with Flutter 3.44.7 (Dart ^3.10). Fix anything `flutter doctor` flags (especially Xcode / CocoaPods).

### B5. Get the code on the Mac

```bash
cd ~
git clone https://github.com/Tmaku18/RADIOapp.git
cd RADIOapp
git checkout main
git pull
cd mobile
```

If you already cloned elsewhere, just `cd` into that folder and `git pull`.

### B6. Check `mobile/.env`

`mobile/.env` is tracked in this private repo. Confirm it has production values (never paste them into docs or chat). Keys:

```env
API_BASE_URL=https://www.networxradio.com
API_DIRECT_URL=...Railway backend host (API calls try this first)...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
STRIPE_PUBLISHABLE_KEY=...
# Optional: SENTRY_DSN=... turns on mobile crash reporting
```

`mobile/.env.example` lists the same keys.

---

## Part C — Verify signing in Xcode (do this once)

```bash
cd ~/RADIOapp/mobile/ios
open Runner.xcworkspace
```

**Important:** open **`Runner.xcworkspace`**, not `Runner.xcodeproj`.

1. Left sidebar → select **Runner** (blue project) → target **Runner**.
2. **Signing & Capabilities** tab:
   - **Team:** Tanaka Makuvaza / `8QZ4S3G53V`
   - **Bundle Identifier:** `com.tmaktechnologies.networxradio`
   - **Automatically manage signing:** ON
3. Confirm the capabilities from `Runner/Runner.entitlements`: **Push Notifications**, **Sign in with Apple**, **App Groups** (`group.com.tmaktechnologies.networxradio`), and **Associated Domains** (`applinks:www.networxradio.com`, `applinks:networxradio.com`).
4. Select target **NowPlayingWidget** and confirm the same team, automatic signing, and the App Group.
5. Set the run destination to **Any iOS Device (arm64)** (not a simulator) if you archive from Xcode later.
6. Quit Xcode when done (optional).

---

## Part D — Build the App Store IPA

### Option 1 — Script (recommended)

```bash
cd ~/RADIOapp/mobile
chmod +x ios/build_appstore.sh
./ios/build_appstore.sh
# Optional overrides:
# BUILD_NAME=1.0.99 BUILD_NUMBER=134 ./ios/build_appstore.sh
```

By default the script reads the version and build number from `pubspec.yaml`. It sources `ios/xcode_env.sh` (points `DEVELOPER_DIR` at `/Applications/Xcode.app` so native-asset hooks can find the iPhoneOS SDK), then runs `flutter clean`, `flutter pub get`, `pod install --repo-update`, and `flutter build ipa --release` with `ios/ExportOptions.plist`.

`ios/ExportOptions.plist` uses method `app-store-connect`, team `8QZ4S3G53V`, automatic signing, symbol upload, and `destination = export`. The build **exports the IPA locally**; it does not upload. Upload it in Part E.

### Option 2 — Manual commands

```bash
cd ~/RADIOapp/mobile
source ios/xcode_env.sh
flutter clean
flutter pub get
cd ios
pod install --repo-update
cd ..
flutter build ipa \
  --release \
  --build-name=1.0.99 \
  --build-number=133 \
  --export-options-plist=ios/ExportOptions.plist
```

### Find the IPA

```bash
ls -la build/ios/ipa/
```

You should see a `.ipa` file (usually `radio_app.ipa`, or named after the product name). The script prints the path when it finishes.

**Every new upload:** increase the build number in `pubspec.yaml` (or pass `BUILD_NUMBER`). Apple rejects reused build numbers.

---

## Part E — Upload to App Store Connect

### Option 1 — Transporter (recommended)

1. Open **Transporter**.
2. Sign in with the same Apple ID.
3. Drag `build/ios/ipa/*.ipa` into Transporter.
4. Click **Deliver**.
5. Wait until it succeeds.

### Option 2 — Xcode Organizer

1. `open ios/Runner.xcworkspace`
2. Menu: **Product** → **Archive** (destination must be a real device / “Any iOS Device”).
3. When Organizer opens: **Distribute App** → **App Store Connect** → **Upload**.
4. Keep defaults (automatic signing) → Upload.

---

## Part F — After upload (App Store Connect)

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **Networx Radio**.
2. **TestFlight** tab → wait for processing (often 5–30 minutes; sometimes longer).
3. Export compliance is pre-answered: `Info.plist` sets `ITSAppUsesNonExemptEncryption` to `false`.
4. Add yourself as an **Internal Tester** and install via TestFlight on an iPhone.
5. When ready for public release:
   - Fill **App Store** listing (screenshots, description, privacy policy URL, age rating, etc.) from `store-assets/listing.md`.
   - Work through `docs/apple-app-store-review-checklist.md`.
   - Select the build → **Add for Review** → **Submit**.

Privacy policy URL: `https://pro-networx.com/privacy` (also served at `https://www.networxradio.com/privacy`).

---

## Part G — Quick verification checklist before submit

- [ ] Bundle ID matches App Store Connect: `com.tmaktechnologies.networxradio`
- [ ] `GoogleService-Info.plist` present under `ios/Runner/`
- [ ] `mobile/.env` has production `API_BASE_URL` and `API_DIRECT_URL`
- [ ] Build number is higher than the last App Store Connect upload
- [ ] TestFlight install works (login, text code, radio play, Google/Apple sign-in)
- [ ] Lock screen / Dynamic Island now-playing card shows and its mute and vote buttons work
- [ ] Artist and song links on `www.networxradio.com` open the app
- [ ] APNs key uploaded to Firebase (for push)

---

## Common errors and fixes

| Error | Fix |
|-------|-----|
| `No Accounts` / signing failed | Xcode → Settings → Accounts → add Apple ID; pick team `8QZ4S3G53V` |
| `No profiles for 'com.tmaktechnologies.networxradio'` | Automatic signing ON; App ID must exist in Developer portal |
| Signing fails on `NowPlayingWidget` or mentions the App Group | Register `com.tmaktechnologies.networxradio.NowPlayingWidget` with the App Group `group.com.tmaktechnologies.networxradio` (Part A1) |
| `xcrun` cannot find the iPhoneOS SDK during the build | Install Xcode at `/Applications/Xcode.app` or export `DEVELOPER_DIR`; `ios/xcode_env.sh` uses it |
| `CocoaPods not installed` | `brew install cocoapods` then `cd ios ; pod install` |
| `Flutter not found` | Install Flutter; ensure `which flutter` works in Terminal |
| Opened `.xcodeproj` instead of workspace | Always open `Runner.xcworkspace` |
| Build number already used | Bump the build number in `pubspec.yaml` or pass `BUILD_NUMBER` |
| Missing `GoogleService-Info.plist` | `git pull` — file is in repo; or re-download from Firebase |
| Push never arrives | Upload APNs `.p8` key to Firebase Cloud Messaging |
| Archive grayed out | Select **Any iOS Device (arm64)**, not a simulator |

---

## Minimal “I already set everything up” path

```bash
cd ~/RADIOapp
git pull
cd mobile
./ios/build_appstore.sh
# then drag build/ios/ipa/*.ipa into Transporter → Deliver
```

Then wait in App Store Connect → TestFlight.
