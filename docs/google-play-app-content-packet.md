# Google Play App Content Packet (NETWORX Android)

Use this as the source packet when filling Play Console **App content** and final
production release forms. Current build: `1.0.99 (133)`.

## App identity

- App name: Networx Radio
- Android package: `com.tmaktechnologies.networxradio`
- Company: DISCOVERMERADIO GROUP LLC
- Privacy policy URL: `https://www.networxradio.com/privacy`
- Child safety standards (CSAE) URL: `https://www.networxradio.com/child-safety`
- Child safety contact: `childsafety@networxradio.com`
- Account deletion URL: `https://www.networxradio.com/delete-account`
- Terms URL: `https://www.networxradio.com/terms`
- Legal center URL: `https://www.networxradio.com/legal`
- Community guidelines URL: `https://www.networxradio.com/community-guidelines`
- DMCA URL: `https://www.networxradio.com/dmca`
- Store listing copy: `docs/play-store-listing.md`
- Support email: `support@networxradio.com`

All of these URLs returned HTTP 200 on 2026-11-23.

See also: `docs/legal/mobile-store-compliance-packet.md`

## Permissions declaration mapping

From `mobile/android/app/src/main/AndroidManifest.xml`:

- `POST_NOTIFICATIONS`
  - Purpose: push notifications for messages, followed-artist and up-next alerts, live sessions, and account activity.
- `WAKE_LOCK`
  - Purpose: maintain audio playback reliability while stream is active.
- `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
  - Purpose: background radio playback with the media notification, lock screen controls, and Android Auto station browsing.
- `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`
  - Purpose: sort the Nearby directory (studios, artists, Catalysts) by distance. After the first Home visit, a one-time explainer with **Not now** comes before the system prompt; the app works without it.
- `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`
  - Purpose: record song clips and Discover videos, go live, and talk over the station from the DJ booth (WebRTC). Camera hardware is optional.
- `INTERNET`
  - Purpose: streaming and API access.
- `com.google.android.gms.permission.AD_ID` is removed with `tools:node="remove"`.

## Data Safety draft mapping

Confirm final answers with legal and product owners before submission.

- Personal info:
  - Name, email, user ID: authentication and account management.
  - Phone number: text-code sign-in verification. Never shown publicly.
- Photos and videos:
  - Profile and cover photos, feed posts, song clips, stories, Discover videos.
- Audio:
  - Song and beat uploads, audio feed posts, microphone audio in clips and live sessions.
- Messages:
  - DMs, station chat, song comments.
- App activity:
  - Plays, fire/pass votes, likes, favorites, follows, ratings, and other in-app actions, recorded by the backend. No third-party analytics SDK.
- App info and performance:
  - Crash logs and diagnostics when the build sets `SENTRY_DSN` in `mobile/.env`. The committed `mobile/.env` does not set it, so confirm per build.
- Location:
  - Approximate location, only when permission is granted, to sort Nearby by distance. Profiles store city and ZIP; maps show a general vicinity.
- Device or other IDs:
  - Push notification token.
- Financial info:
  - Purchase history and store transaction references.
- Data is encrypted in transit. Users can delete their account inside the app.

## Ads declaration

- The shipped app does not show ads. There is no ads SDK.
- `AndroidManifest.xml` removes `com.google.android.gms.permission.AD_ID` so a Google library cannot merge the advertising ID.
- In Play Console, set **Contains ads** to **No** and do not declare advertising ID in Data safety.

## Content rating and target audience

- Complete the Play content rating questionnaire based on actual shipped content.
- Because creator uploads may include explicit tracks, ensure rating answers include
  mature-language/music descriptors where applicable.
- The app includes user-generated content, public chat, DMs, and livestreams, with report and block.
- Confirm target audience settings are not configured as children-directed.
- Ensure in-app and listing statements remain consistent with:
  - privacy policy,
  - community guidelines,
  - explicit labeling and Clean Rap Radio behavior.

## Payments declaration

- Every digital purchase on Android uses Google Play Billing: discovery placements, song and beat purchases, livestream tips, Refinery submissions, and the Pro-Radio, Pro-Networx, and Pro Bundle subscriptions. The app has no external checkout links.
- Discovery placements: one placement is **$1.99**. Packs are **$4.99** (3), **$9.99** (5), **$17.99** (10), **$39.99** (25), **$75.99** (50),
  and **$150** (100), with bonus placements on packs. Each placement targets ~**100 verified listener exposures**
  (see `packPriceCents()` and `bonusPlacementsFor()` in `backend/src/payments/payments.service.ts`).
- Credit packs are no longer sold.
- Backend verification endpoints: `POST /api/payments/google-play/complete` and `POST /api/payments/google-play/complete-subscription`.
- Web payment flows use Stripe.

## Account management and deletion

- In-app account management exists via Settings.
- Account deletion is inside the app: Settings → Account → Delete account, Help & Legal → Delete account, or the bottom of My Profile. The user types `delete` to confirm. The account is kept for 48 hours, and signing in again within that window restores it; after that it is permanently deleted.
- Store subscriptions must be cancelled in Google Play; the delete dialog says so.
- Users without app access can follow `https://www.networxradio.com/delete-account` to request deletion by email.
- Support contact: `support@networxradio.com`. Ensure Play listing support email and policy docs match this address.

## Final pre-submit gate (must pass)

1. Build signed AAB with incremented build number:
   - `flutter build appbundle --release` (uses `mobile/pubspec.yaml`), or add `--build-number <n>`
2. Upload to Internal testing track first.
3. Verify policy pages are public over HTTPS and not blocked.
4. Complete App content:
   - Data Safety
   - Ads
   - Content rating
   - Target audience
   - Privacy policy URL
   - Account deletion URL
   - App access details (demo account, plus how reviewers receive the sign-in text code when verification is active)
5. Confirm Android billing products are active in Play Console and IDs match:
   - `mobile/lib/core/services/play_billing_service.dart` (and any mobile env overrides)
   - backend `backend/src/payments/iap-product-catalog.ts` and `GOOGLE_PLAY_PRODUCT_CATALOG_JSON`
6. Validate runtime checks from `docs/android-14-15-smoke-test.md`.
7. Resolve all Play policy warnings before production rollout.
