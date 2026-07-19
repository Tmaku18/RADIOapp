# Apple App Store Review Checklist (iOS)

This checklist is for NETWORX iOS releases submitted through App Store Connect.

## 1) App identity and metadata

- App name is correct and matches in-app branding.
- Bundle identifier and version/build numbers are incremented.
- Support URL and marketing URL are valid.
- App category/subcategory are accurate.

## 2) Required legal and policy links

Verify these links are live over HTTPS and publicly accessible:

- Privacy Policy: `https://pro-networx.com/privacy`
- Terms of Service: `https://pro-networx.com/terms`
- Legal Center: `https://pro-networx.com/legal`
- Community Guidelines: `https://pro-networx.com/community-guidelines`
- DMCA Policy: `https://pro-networx.com/dmca`

Set Privacy Policy URL in App Store Connect and expose policy access in-app.

## 3) App privacy questionnaire

- App Store Connect privacy answers match shipped behavior for:
  - account identifiers,
  - user-generated content and chat/reactions,
  - usage/activity analytics,
  - diagnostics/crash data,
  - location (only when feature and permission are used),
  - purchase metadata.
- Data collection purpose declarations are accurate (app functionality, security, analytics, support).

## 4) Age rating and explicit media

- Complete age rating questionnaire honestly in App Store Connect.
- Ensure descriptors reflect creator-uploaded music and possible explicit content.
- Confirm explicit-label flow is live:
  - artists can mark tracks explicit,
  - admins can correct labels.
- Confirm clean rap station is available and excludes explicit tracks.

## 5) User-generated content safeguards

- Moderation/reporting path is operational (community guidelines + support channels).
- Content removal/escalation process is documented internally.
- Copyright and DMCA reporting channels are visible and monitored.

## 6) Account access and deletion

- Account management is available in-app.
- Deletion support channel is active: `support@networxradio.com`.
- Any account-deletion flow shown to reviewers behaves as documented.

## 7) Reviewer access and test instructions

- Provide App Review test credentials if any protected areas require sign-in.
- Include concise reviewer notes for:
  - how to access radio playback,
  - where to view legal links,
  - where to find support/reporting options.
- If any feature requires specific region/device setup, document it in review notes.

## 8) Final submission gate

1. Install release build on physical iOS device and smoke test core flows.
2. Validate login, playback, station switching, notifications, and purchase paths.
3. Validate legal URLs from within app surfaces.
4. Validate explicit/clean station behavior with test tracks.
5. Resolve App Store Connect warnings before submission.
