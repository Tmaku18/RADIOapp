# Google Play App Content Packet (NETWORX Android)

Use this as the source packet when filling Play Console **App content** and final
production release forms.

## App identity

- App name: NETWORX (Radio App)
- Android package: `com.radioapp.radio_app`
- Company: DISCOVERMERADIO GROUP LLC
- Privacy policy URL: `https://discovermeradio.com/privacy` (publish and verify)
- Terms URL: `https://discovermeradio.com/terms` (publish and verify)
- Legal center URL: `https://discovermeradio.com/legal` (publish and verify)

## Permissions declaration mapping

From `mobile/android/app/src/main/AndroidManifest.xml`:

- `POST_NOTIFICATIONS`
  - Purpose: push notifications for song/live updates and account alerts.
- `WAKE_LOCK`
  - Purpose: maintain audio playback reliability while stream is active.
- `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
  - Purpose: persistent foreground media playback service.
- `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`
  - Purpose: nearby artist/pro-directory discovery features.

## Data Safety draft mapping

Confirm final answers with legal and product owners before submission.

- Account identifiers:
  - Email / user ID collected for authentication and account management.
- User content:
  - Profile information, uploads, chat messages, reactions.
- App activity:
  - Playback events, likes/reactions, analytics events.
- Diagnostics:
  - Error logs and crash reporting.
- Location:
  - Approximate/precise location only when nearby features are used.
- Financial info:
  - Purchase metadata and transaction references (platform/store and backend).

## Ads declaration

- Current product policy in repo indicates no interrupting audio ads in core radio,
  but visual sponsorship/ad placements may exist in app surfaces.
- In Play Console, set Ads declaration to match actual shipped build behavior.

## Payments declaration

- Android in-app purchases use Google Play Billing.
- Song-play purchases follow dynamic pricing: **$1/minute per play**, so total price
  changes by song duration and selected play count.
- Backend verification endpoint: `POST /api/payments/google-play/complete`.
- Web/non-Android payment flows remain Stripe where allowed.

## Account management and deletion

- In-app account management exists via Settings/Profile flows.
- Account deletion support contact: `support@networxradio.com`.
- Ensure Play listing support email and policy docs match this address.

## Final pre-submit gate (must pass)

1. Build signed AAB with incremented build number:
   - `flutter build appbundle --release --build-number <n>`
2. Upload to Internal testing track first.
3. Verify policy pages are public over HTTPS and not blocked.
4. Complete App content:
   - Data Safety
   - Ads
   - Content rating
   - Target audience
   - Privacy policy URL
5. Confirm Android billing products are active in Play Console and IDs match:
   - mobile env IDs
   - backend `GOOGLE_PLAY_PRODUCT_CATALOG_JSON`
6. Validate runtime checks from `docs/android-14-15-smoke-test.md`.
7. Resolve all Play policy warnings before production rollout.
