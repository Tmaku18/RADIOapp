#!/bin/sh
# Sourced by Xcode Run Script phases and build_appstore.sh so native-asset
# hooks (objective_c) can resolve the iPhoneOS SDK via xcrun.
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export PATH="$DEVELOPER_DIR/usr/bin:/usr/bin:/bin:${PATH:-}"
if [ -z "${SDKROOT:-}" ] && [ -x "$DEVELOPER_DIR/usr/bin/xcrun" ]; then
  SDKROOT="$("$DEVELOPER_DIR/usr/bin/xcrun" --show-sdk-path --sdk iphoneos 2>/dev/null)" || true
  export SDKROOT
fi
