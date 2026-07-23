# Networx Radio — iOS App Store upload (from scratch on a Mac)

Use this on a **Mac** with your Apple Developer account (**Team ID `8QZ4S3G53V`**).

| Setting | Value |
|---------|--------|
| App name | Networx Radio |
| Bundle ID | `com.tmaktechnologies.networxradio` |
| Team ID | `8QZ4S3G53V` |
| Marketing version | `1.0.15` |
| First iOS build number | `32` (must increase every upload; Android already used `31`) |
| Repo path (on Mac) | `RADIOapp/mobile` |

---

## Part A — One-time Apple / Firebase setup

Skip any step you already finished.

### A1. Apple Developer — App ID

1. Open [developer.apple.com/account](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**.
2. **Identifiers** → **+** → **App IDs** → **App** → Continue.
3. Fill in:
   - **Description:** `Networx Radio`
   - **Bundle ID:** Explicit → `com.tmaktechnologies.networxradio`
4. On **Capabilities**, enable only:
   - **Push Notifications**
   - **Sign In with Apple** → Configure → Primary App ID → Save
   - **In-App Purchase** (product + server setup: [`APP_STORE_IAP.md`](./APP_STORE_IAP.md))
5. **App Services** and **Capability Requests:** leave empty / no requests.
6. Continue → Register.

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

Keep `mobile/ios/Runner/GoogleService-Info.plist` on the build machine
(it is gitignored — download from Firebase Console → Project settings → Your apps → iOS
if missing). Without it, Firebase Messaging / Auth will not initialize correctly.

### A4. (Recommended) APNs key for push

1. Apple Developer → **Keys** → **+**.
2. Name: `Networx APNs`.
3. Enable **Apple Push Notifications service (APNs)** → Continue → Register.
4. Download the `.p8` once; note **Key ID** and Team ID `8QZ4S3G53V`.
5. Firebase Console → Project settings → **Cloud Messaging** → iOS → upload the APNs key.

Without this, builds still upload, but push notifications on iOS will not work.

---

## Part B — Mac machine setup (first time)

### B1. Install Xcode

1. Mac App Store → install **Xcode** (latest stable).
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

### B4. Install Flutter, CocoaPods, Git

```bash
brew install git cocoapods
brew install --cask flutter
flutter doctor
```

Fix anything `flutter doctor` flags (especially Xcode / CocoaPods).

Optional but useful:

```bash
brew install --cask transporter
```

### B5. Get the code on the Mac

```bash
cd ~
git clone https://github.com/Tmaku18/RADIOapp.git
cd RADIOapp
git checkout main
git pull
cd mobile
```

If you already cloned elsewhere, just `cd` into that `RADIOapp` folder and `git pull`.

### B6. Create `mobile/.env`

```bash
cd ~/RADIOapp/mobile   # or your clone path
cp .env.example .env
```

Edit `.env` with production values (same idea as Android/web):

```env
API_BASE_URL=https://www.networxradio.com
SUPABASE_URL=...your real supabase url...
SUPABASE_ANON_KEY=...your real anon key...
STRIPE_PUBLISHABLE_KEY=pk_live_...or pk_test_...
```

`.env` is gitignored — do not commit it.

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
3. Confirm you see **Push Notifications**, and that Sign in with Apple / IAP can be added if Xcode prompts (capabilities are already on the App ID).
4. Set the run destination to **Any iOS Device (arm64)** (not a simulator) if you archive from Xcode later.
5. Quit Xcode when done (optional).

---

## Part D — Build the App Store IPA

### Option 1 — Script (recommended)

```bash
cd ~/RADIOapp/mobile
chmod +x ios/build_appstore.sh
BUILD_NAME=1.0.15 BUILD_NUMBER=32 ./ios/build_appstore.sh
```

This runs `flutter clean`, `pub get`, `pod install`, then `flutter build ipa` with App Store export options.

### Option 2 — Manual commands

```bash
cd ~/RADIOapp/mobile
flutter clean
flutter pub get
cd ios
pod install --repo-update
cd ..
flutter build ipa \
  --release \
  --build-name=1.0.15 \
  --build-number=32 \
  --export-options-plist=ios/ExportOptions.plist
```

### Find the IPA

```bash
ls -la build/ios/ipa/
```

You should see a `.ipa` file (often named like `radio_app.ipa` or similar).

**Every new upload:** increase `BUILD_NUMBER` (33, 34, …). Apple rejects reused build numbers.

---

## Part E — Upload to App Store Connect

### Option 1 — Transporter (easiest)

1. Open **Transporter** (Mac App Store).
2. Sign in with the same Apple ID.
3. Drag `build/ios/ipa/*.ipa` into Transporter.
4. Click **Deliver**.
5. Wait until it succeeds.

### Option 2 — Xcode Organizer

1. `open ios/Runner.xcworkspace`
2. Menu: **Product** → **Archive** (destination must be a real device / “Any iOS Device”).
3. When Organizer opens: **Distribute App** → **App Store Connect** → **Upload**.
4. Keep defaults (automatic signing) → Upload.

### Option 3 — Flutter already uploaded?

`ExportOptions.plist` uses `destination = upload`. If `flutter build ipa` completed with upload credentials available, it may have uploaded already. Still check App Store Connect → TestFlight.

---

## Part F — After upload (App Store Connect)

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **Networx Radio**.
2. **TestFlight** tab → wait for processing (often 5–30 minutes; sometimes longer).
3. If prompted for **Export Compliance** / encryption:
   - Most apps that only use HTTPS can answer that they use encryption only for standard HTTPS (follow Apple’s questionnaire carefully).
4. Add yourself as an **Internal Tester** and install via TestFlight on an iPhone.
5. When ready for public release:
   - Fill **App Store** listing (screenshots, description, privacy policy URL, age rating, etc.).
   - Select the build → **Add for Review** → **Submit**.

Privacy policy URL (you already have legal pages): e.g. `https://www.networxradio.com/legal` (use your live legal/privacy URL).

---

## Part G — Quick verification checklist before first submit

- [ ] Bundle ID matches App Store Connect: `com.tmaktechnologies.networxradio`
- [ ] `GoogleService-Info.plist` present under `ios/Runner/`
- [ ] `.env` has production `API_BASE_URL`
- [ ] Build number is new (`32` for first iOS upload)
- [ ] TestFlight install works (login, radio play, Google/Apple sign-in)
- [ ] APNs key uploaded to Firebase (for push)

---

## Common errors and fixes

| Error | Fix |
|-------|-----|
| `No Accounts` / signing failed | Xcode → Settings → Accounts → add Apple ID; pick team `8QZ4S3G53V` |
| `No profiles for 'com.tmaktechnologies.networxradio'` | Automatic signing ON; App ID must exist in Developer portal |
| `CocoaPods not installed` | `brew install cocoapods` then `cd ios ; pod install` |
| `Flutter not found` | Install Flutter; ensure `which flutter` works in Terminal |
| Opened `.xcodeproj` instead of workspace | Always open `Runner.xcworkspace` |
| Build number already used | Bump `BUILD_NUMBER` |
| Missing `GoogleService-Info.plist` | `git pull` — file is in repo; or re-download from Firebase |
| Push never arrives | Upload APNs `.p8` key to Firebase Cloud Messaging |
| Archive grayed out | Select **Any iOS Device (arm64)**, not a simulator |

---

## Minimal “I already set everything up” path

```bash
cd ~/RADIOapp
git pull
cd mobile
# ensure .env exists with production values
BUILD_NAME=1.0.15 BUILD_NUMBER=32 ./ios/build_appstore.sh
# then drag build/ios/ipa/*.ipa into Transporter → Deliver
```

Then wait in App Store Connect → TestFlight.
