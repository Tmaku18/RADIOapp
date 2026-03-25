# Android 14/15 Smoke Test (Pre-Play Upload)

Use this for every Android release candidate before moving from Internal testing to Production.

## Build/config verification

1. Confirm build config still enforces API 35+:
   - `mobile/android/app/build.gradle.kts` has `targetSdk = maxOf(..., 35)`.
2. Verify current Flutter app version:
   ```bash
   rg "^version:" mobile/pubspec.yaml
   ```
3. Build release AAB with incremented build number:
   ```bash
   cd mobile
   flutter build appbundle --release --build-number <n>
   ```

## Runtime checks on Android 14/15 device

1. Authentication:
   - Email/password login works.
   - Google sign-in works.
2. Playback:
   - Radio starts, pauses, resumes.
   - Foreground media service notification appears while playing.
3. Notifications:
   - App requests notification permission (Android 13+).
   - Push notification opens correct destination.
4. Location:
   - Location permission prompt appears when nearby features are used.
   - Nearby screen handles denied permission gracefully.
5. Payments:
   - Android purchase path uses Google Play Billing (no in-app Stripe payment sheet).
6. Live services (Gem/Catalyst):
   - **More → Live services** (or Studio → Live services): add a listing, delete it, open **Support** and submit with a valid `discord.com` / `discord.gg` link (backend email or console log).
7. Stability:
   - No startup crash after cold launch.
   - No crash when app returns from background while audio is active.

## Sign-off

- Internal testing build uploaded in Play Console.
- No blocking policy warnings remain.
- QA sign-off captured before production rollout.
