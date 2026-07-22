#!/usr/bin/env bash
# Build and upload Networx Radio to App Store Connect.
# Run this on a Mac with Xcode + Flutter installed (cannot run on Windows).
#
# Prerequisites:
#   1. App ID registered: com.tmaktechnologies.networxradio
#   2. App created in App Store Connect
#   3. Signed into Xcode with Apple ID (Team 8QZ4S3G53V)
#   4. ios/Runner/GoogleService-Info.plist present (Firebase iOS app)
#   5. CocoaPods installed: sudo gem install cocoapods
#
# Usage (from mobile/):
#   chmod +x ios/build_appstore.sh
#   ./ios/build_appstore.sh
# Optional:
#   BUILD_NAME=1.0.29 BUILD_NUMBER=53 ./ios/build_appstore.sh

set -euo pipefail

cd "$(dirname "$0")/.."

BUILD_NAME="${BUILD_NAME:-1.0.29}"
BUILD_NUMBER="${BUILD_NUMBER:-53}"
BUNDLE_ID="com.tmaktechnologies.networxradio"
TEAM_ID="8QZ4S3G53V"

echo "==> Flutter clean / pub get"
flutter clean
flutter pub get

echo "==> CocoaPods"
cd ios
pod install --repo-update
cd ..

echo "==> Building IPA (name=$BUILD_NAME number=$BUILD_NUMBER)"
flutter build ipa \
  --release \
  --build-name="$BUILD_NAME" \
  --build-number="$BUILD_NUMBER" \
  --export-options-plist=ios/ExportOptions.plist

IPA_PATH="build/ios/ipa/radio_app.ipa"
if [[ ! -f "$IPA_PATH" ]]; then
  # Flutter may name the IPA after the display/product name
  IPA_PATH="$(find build/ios/ipa -name '*.ipa' | head -n 1)"
fi

echo ""
echo "IPA ready: $IPA_PATH"
echo "Bundle ID: $BUNDLE_ID"
echo "Team:      $TEAM_ID"
echo ""
echo "Upload options:"
echo "  1) Xcode Organizer: open ios/Runner.xcworkspace → Product → Archive → Distribute App"
echo "  2) Transporter app: drag the .ipa onto Transporter and Deliver"
echo "  3) CLI (if xcrun altool / notarytool available):"
echo "     xcrun altool --upload-app -f \"$IPA_PATH\" -t ios -u YOUR_APPLE_ID -p @keychain:AC_PASSWORD"
echo ""
echo "After upload, open App Store Connect → Networx Radio → TestFlight and wait for processing."
