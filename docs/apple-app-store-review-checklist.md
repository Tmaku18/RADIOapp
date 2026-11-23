# Apple App Store Review Checklist (iOS)

This checklist is for NETWORX iOS releases submitted through App Store Connect.

## 1) App identity and metadata

- App name is correct and matches in-app branding (`Networx Radio`).
- Bundle identifier is `com.tmaktechnologies.networxradio`; the Now Playing widget extension is `com.tmaktechnologies.networxradio.NowPlayingWidget`.
- Version/build numbers come from `mobile/pubspec.yaml` (currently `1.0.99+133`) and the build number is higher than any build already in App Store Connect.
- Support URL and marketing URL are valid.
- App category/subcategory are accurate.
- Listing copy and privacy labels: `store-assets/listing.md`.

## 2) Required legal and policy links

Verify these links are live over HTTPS and publicly accessible:

- Privacy Policy: `https://pro-networx.com/privacy`
- Terms of Service: `https://pro-networx.com/terms`
- Legal Center: `https://pro-networx.com/legal`
- Community Guidelines: `https://pro-networx.com/community-guidelines`
- DMCA Policy: `https://pro-networx.com/dmca`
- Account deletion: `https://www.networxradio.com/delete-account`

Set Privacy Policy URL in App Store Connect. In the app, policy links are in Settings → Legal and support, Help & Legal, About, the sign-up screen, and every subscription paywall.

## 3) App privacy questionnaire

- App Store Connect privacy answers match shipped behavior for:
  - account identifiers (email, name, user ID) and the verified phone number,
  - user-generated content: uploads, photos, videos, audio, messages, comments, and reactions,
  - product interaction (plays, votes, likes, follows) recorded by the backend,
  - diagnostics/crash data when the build sets `SENTRY_DSN`,
  - location (only when permission is granted, for Nearby),
  - push token (device ID),
  - purchase history.
- Data collection purpose declarations are accurate (app functionality, security, analytics, support).
- No tracking: `ios/Runner/PrivacyInfo.xcprivacy` sets `NSPrivacyTracking` to false. Keep its collected data types in step with the App Store Connect answers.

## 4) Permissions, capabilities, and export compliance

- `Info.plist` purpose strings exist for location when in use, camera, microphone, photo library, and photo library add.
- Background modes: `audio` and `remote-notification`. Live Activities are enabled (`NSSupportsLiveActivities`) for the lock screen and Dynamic Island now-playing card with mute and fire/pass votes.
- `Runner.entitlements`: Push Notifications (`aps-environment` production), Sign in with Apple, App Group `group.com.tmaktechnologies.networxradio` (shared with the widget), and Associated Domains `applinks:www.networxradio.com` and `applinks:networxradio.com`.
- Export compliance: `ITSAppUsesNonExemptEncryption` is `false`.

## 5) Age rating and explicit media

- Complete age rating questionnaire honestly in App Store Connect.
- Ensure descriptors reflect creator-uploaded music, video, livestreams, chat, and possible explicit content.
- Confirm explicit-label flow is live:
  - artists can mark tracks explicit,
  - admins can correct labels.
- Confirm Clean Rap Radio is available and excludes explicit tracks.

## 6) User-generated content safeguards

- Terms and Community Guidelines are accepted at sign-up.
- Report and Block work from profiles, posts, songs, chat, DMs, and live rooms; blocked accounts are listed in Settings.
- Content removal/escalation process is documented internally.
- Copyright and DMCA reporting channels are visible and monitored.

## 7) Account access and deletion

- Account management is available in-app.
- Delete account is in Settings → Account, Help & Legal, and at the bottom of My Profile. The user types `delete` to confirm; the account is kept 48 hours and then permanently deleted, and signing in within that window restores it.
- Deletion also revokes the Sign in with Apple token (backend needs `APPLE_TEAM_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_PRIVATE_KEY`).
- The delete dialog tells users to cancel App Store subscriptions separately.
- Email fallback: `support@networxradio.com`.

## 8) Reviewer access and test instructions

- Provide App Review test credentials. Reviewers can also tap **Continue as guest** to browse without an account.
- When text-code sign-in verification is active in production, explain how the reviewer receives the code for the demo account. There is no reviewer bypass in code.
- Include concise reviewer notes for:
  - how to access radio playback,
  - where to view legal links,
  - where to find support, reporting, and account deletion,
  - where Restore purchases lives (Settings → Legal and support).
- If any feature requires specific region/device setup, document it in review notes.

## 9) Final submission gate

1. Install release build on physical iOS device and smoke test core flows.
2. Validate login (email, Google, Apple, text code), guest browsing, playback, station switching, lock screen controls, notifications, and purchase paths.
3. Validate legal URLs from within app surfaces.
4. Validate explicit/clean station behavior with test tracks.
5. Validate that artist, song, and radio links on `www.networxradio.com` open the app (Universal Links).
6. Resolve App Store Connect warnings before submission.
