# NETWORX Mobile Store Compliance Packet

Last updated: 2026-03-28

This packet centralizes policy and compliance details required for App Store and Google Play review of the NETWORX mobile app.

## 1) Canonical public legal URLs

- Privacy Policy: `https://discovermeradio.com/privacy`
- Terms of Service: `https://discovermeradio.com/terms`
- Legal Center: `https://discovermeradio.com/legal`
- Community Guidelines: `https://discovermeradio.com/community-guidelines`
- DMCA Policy: `https://discovermeradio.com/dmca`
- Refund Policy: `https://discovermeradio.com/refunds`
- Copyright Policy: `https://discovermeradio.com/copyright-policy`

All links must be publicly accessible over HTTPS without authentication.

Source draft for policy maintenance: `docs/legal/privacy-policy.md`.

## 2) Data handling disclosures (store forms baseline)

NETWORX handles the following categories in support of core radio and creator features:

- Account identifiers (email, auth IDs, profile fields).
- User content (song uploads, profile media, chat/reactions).
- App activity (playback, votes/reactions, engagement telemetry).
- Diagnostics (crash logs, performance/error traces).
- Location data (only when nearby discovery features are used and permission is granted).
- Purchase metadata (platform transaction references and backend verification artifacts).

Use these categories to complete:

- Google Play Data safety form.
- App Store Connect privacy nutrition labels.

## 3) User-generated content and moderation posture

NETWORX supports creator-uploaded audio and community interactions. The app enforces:

- Community guidelines with disallowed content categories.
- Creator moderation and admin enforcement workflows (approve/reject/remove content).
- User reporting channels for abusive, infringing, or unsafe content.
- DMCA intake and handling process for copyright complaints.

Operational contacts:

- Safety/support: `support@networxradio.com`
- Legal/rights: `legal@networxradio.com`
- DMCA notices: `dmca@networxradio.com`

## 4) Explicit audio policy

NETWORX includes explicit-content labeling at the track level.

- Artists can label tracks as explicit during upload/edit flows.
- Admins can override labels for policy correctness.
- A dedicated clean rap station excludes tracks marked explicit.

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
- Account deletion requests are honored via `support@networxradio.com`.
- Store listing support email and in-app support contact must stay aligned.

## 7) Reviewer test readiness package

Before submitting to either store:

1. Confirm all legal URLs above are live and accurate.
2. Confirm explicit-label flow works for artist and admin roles.
3. Confirm clean rap station excludes explicit tracks in queue/playback.
4. Confirm report/contact channels are visible and monitored.
5. Confirm privacy disclosures match actual data collection and permissions in shipped build.

## 8) Ownership and legal review

This document is an implementation packet for release operations and engineering. Final production legal language and jurisdiction-specific requirements must be reviewed by qualified counsel before broad public launch.
