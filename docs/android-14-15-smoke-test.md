# Android 14/15 Smoke Test (Pre-Play Upload)

Use this for every Android release candidate before moving from Internal testing to Production.

## Build/config verification

1. Confirm build config still enforces API 35+:
   - `mobile/android/app/build.gradle.kts` has `compileSdk = maxOf(..., 35)` and `targetSdk = maxOf(..., 35)`.
2. Verify current Flutter app version:
   ```bash
   rg "^version:" mobile/pubspec.yaml
   ```
3. Build release AAB with incremented build number:
   ```bash
   cd mobile
   flutter build appbundle --release --build-number <n>
   ```
4. Confirm `https://www.networxradio.com/.well-known/assetlinks.json` lists the Play App Signing SHA-256 (`ANDROID_APP_LINK_SHA256` on Vercel). An empty `sha256_cert_fingerprints` list makes shared links open in the browser.

## Runtime checks on Android 14/15 device

1. Authentication:
   - The app opens for a guest; favoriting a song or sending a message asks the guest to sign in.
   - Email/password login works, and **Forgot password** sends a reset email.
   - Google sign-in works; a first-time Google sign-in lands on profile setup.
   - When text verification is on (Twilio configured), a new sign-in asks for the text code before the account can be used.
2. Playback:
   - Radio starts, pauses, resumes, and mute/unmute stays on through song changes and station switches.
   - The app reopens on the last station played.
   - Dragging up on the bottom player opens the full player on the song already playing; a downward swipe closes it.
   - Fire and poop votes respond on the first tap.
   - Foreground media service notification appears while playing, with play/pause and stop.
3. Android Auto and home-screen widget:
   - In Android Auto (or the Desktop Head Unit), the station list appears and a station plays.
   - The **NetworX Radio** Now Playing widget can be added and shows the current song; tapping it opens the app.
4. Deep links (App Links):
   - `https://www.networxradio.com/open/artists/<id>` opens the artist profile in the installed app.
   - `https://www.networxradio.com/song/<id>` and `https://www.networxradio.com/radio/<station>` open the app.
   - `networxradio://artist/<id>` opens the artist profile.
   - Sharing an artist profile from the app produces an `https://www.networxradio.com/open/artists/<id>` link.
5. Notifications:
   - App requests notification permission (Android 13+).
   - A push notification (e.g. a followed artist up next, or a new follower) opens the matching screen.
6. Location:
   - Location permission prompt appears when the **Nearby** tab in Pro-Networx Studios is opened.
   - The Nearby tab handles denied permission gracefully.
7. Camera and microphone:
   - Recording a song clip from the player asks for camera and microphone, records, and plays back.
8. Payments:
   - Pro-Radio, Pro-Networx, Pro Bundle, placements, and tips use Google Play Billing (no in-app Stripe payment sheet).
   - **Restore purchases** on a paywall restores an existing subscription.
9. Live services (streamer accounts):
   - **More → Live services**: add a listing, delete it, open **Support** and submit with a valid `discord.com` / `discord.gg` link (backend email or console log).
10. Stability:
    - No startup crash after cold launch.
    - No crash when app returns from background while audio is active.

## Sign-off

- Internal testing build uploaded in Play Console.
- No blocking policy warnings remain.
- QA sign-off captured before production rollout.
