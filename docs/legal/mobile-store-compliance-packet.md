# NETWORX Mobile Store Compliance Packet

Last updated: 2026-11-23

This packet centralizes policy and compliance details required for App Store and Google Play review of the NETWORX mobile app (bundle/package `com.tmaktechnologies.networxradio`, current build `1.0.99 (133)`).

## 1) Canonical public legal URLs

The same Next.js app serves these pages on both domains. The app opens the `pro-networx.com` links (they redirect to `www.pro-networx.com`); store forms can use either domain.

- Privacy Policy: `https://pro-networx.com/privacy` (also `https://www.networxradio.com/privacy`)
- Terms of Service: `https://pro-networx.com/terms`
- Legal Center: `https://pro-networx.com/legal`
- Community Guidelines: `https://pro-networx.com/community-guidelines`
- DMCA Policy: `https://pro-networx.com/dmca`
- Refund Policy: `https://pro-networx.com/refunds`
- Copyright Policy: `https://pro-networx.com/copyright-policy`
- Child safety standards: `https://www.networxradio.com/child-safety`
- Account deletion: `https://www.networxradio.com/delete-account`

All links must be publicly accessible over HTTPS without authentication. Each URL above returned HTTP 200 on 2026-11-23.

The published privacy page is `web/src/app/(marketing)/privacy/page.tsx`. `docs/legal/privacy-policy.md` is a copy of that page's text.

## 2) Data handling disclosures (store forms baseline)

NETWORX handles the following categories in support of core radio and creator features:

- Account identifiers: email, name/display name, username, Firebase user ID, profile photo.
- Phone number: a verified mobile number per account for text-code sign-in verification (`146_phone_mfa.sql`). It is never shown on public profiles.
- User content: song and beat uploads, cover art, profile and Pro-Networx media, feed posts (photo, video, audio), song clips and stories, DMs, chat, comments, reactions, and reports.
- Camera and microphone: used when the user records a clip or Discover video, goes live, or broadcasts from the DJ booth (WebRTC).
- App activity: plays and listens, fire/pass votes, likes, favorites, follows, ratings, and other engagement recorded by the backend. The mobile app has no third-party analytics SDK.
- Diagnostics: backend errors go to Sentry. The mobile Sentry SDK starts only when `SENTRY_DSN` is set in `mobile/.env`; declare crash data whenever a shipped build sets it.
- Location: device location is read only when the user grants permission, to sort the Nearby directory by distance. Profiles store city and ZIP, and map pins are offset to a general vicinity around the ZIP.
- Device identifiers: push notification (FCM/APNs) tokens.
- Purchase metadata: App Store / Google Play transaction references and backend verification records.

The app does not show ads. The Android manifest removes `com.google.android.gms.permission.AD_ID`, and `ios/Runner/PrivacyInfo.xcprivacy` declares no tracking.

Use these categories to complete:

- Google Play Data safety form.
- App Store Connect privacy nutrition labels.

## 3) User-generated content and moderation posture

NETWORX supports creator-uploaded audio and video plus community interactions. The app enforces:

- Terms and Community Guidelines acceptance at sign-up, with zero tolerance for objectionable content.
- Report and Block from profiles, posts, songs, chat, DMs, and live rooms; blocked accounts are listed in Settings.
- Song reports with reasons from the radio player's more menu.
- Admin moderation: approve/reject songs, remove content, shadow ban, lifetime ban, and account deletion (with confirmation).
- Automatic flags for accounts that flood comments or likes, for admin review.
- Copyright matching on uploads (ACRCloud) with admin copyright flags.
- DMCA intake and handling process for copyright complaints.

Operational contacts:

- Safety/support: `support@networxradio.com`
- Legal/rights: `legal@networxradio.com`
- Copyright and DMCA notices: `copyright@networxradio.com`
- Child safety: `childsafety@networxradio.com`

## 4) Explicit audio policy

NETWORX includes explicit-content labeling at the track level.

- Artists can label tracks as explicit during upload/edit flows.
- Admins can override labels for policy correctness.
- Clean Rap Radio (`us-rap-clean`) only plays tracks not marked explicit.

This policy should be reflected in:

- App Store age rating answers and content descriptors.
- Google Play content rating questionnaire responses.
- In-app copy where station/content expectations are presented.

## 5) Age suitability and children

- NETWORX is not directed to children under 13.
- NETWORX does not knowingly collect personal information from children under 13.
- Age/content descriptors in store metadata must match actual in-app experiences.
- Any region-specific content warnings required for music media must be completed before release.

## 6) Account management and deletion

- Users can manage profile/account settings in-app.
- Self-service deletion is in the app under Settings → Account → Delete account, Help & Legal → Delete account, and at the bottom of My Profile. The web app offers the same flow.
- The user reads the warnings and types `delete` to confirm. The account is signed out and kept for 48 hours (`148_account_deletion_grace.sql`). Signing in again within 48 hours restores it; after that an hourly job permanently deletes the account and its data, cancels Stripe subscriptions, and revokes the Sign in with Apple token.
- Deleting the account does not cancel App Store or Google Play subscriptions; the delete dialog tells users to cancel in their store account first.
- Users without app access can request deletion by email from `https://www.networxradio.com/delete-account` (`support@networxradio.com`).
- Store listing support email and in-app support contact must stay aligned.

## 7) Reviewer test readiness package

Before submitting to either store:

1. Confirm all legal URLs above are live and accurate.
2. Confirm explicit-label flow works for artist and admin roles.
3. Confirm Clean Rap Radio excludes explicit tracks in queue/playback.
4. Confirm report/block and contact channels are visible and monitored.
5. Confirm the delete-account flow schedules deletion and that signing in within 48 hours restores the account.
6. Confirm privacy disclosures match actual data collection and permissions in the shipped build (`AndroidManifest.xml`, `Info.plist`, `PrivacyInfo.xcprivacy`).
7. When text-code sign-in verification is active in production (Twilio configured), give reviewers a way to receive the code for the demo account. The code has no reviewer bypass.

## 8) Ownership and legal review

This document is an implementation packet for release operations and engineering. Final production legal language and jurisdiction-specific requirements must be reviewed by qualified counsel before broad public launch.
