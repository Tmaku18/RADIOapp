# NetworX Radio store listing

Version for this build: **1.0.99 (133)**

The current app icon stays in the binary. A cyan butterfly concept is in `icon-concept-cyan-butterfly.jpg` if you want to swap it later. Screenshot files in this folder are branded mockups for the listing draft. Recapture live screens from the simulator before you upload, using the same headlines.

## App name

NetworX Radio

## Subtitle (iOS, 30 characters)

Live radio. Independent music.

## Promotional text (iOS, 170 characters)

Hear independent artists on live stations, vote on what plays next, and message the people you discover.

## Short description (Google Play, 80 characters)

Live independent radio, artist discovery, and a place to vote on what plays next.

## Full description

NetworX Radio is a live station for independent music.

Tune into genre stations, hear what is playing now, and vote with fire when a song hits. Artists upload music for rotation, go live, and reach listeners without a label in the middle.

What you can do:

- Listen to live stations across rap, country, rock, pop, gospel, and more, including Clean Rap Radio
- Vote fire or pass, rate songs, and comment on what is playing
- Record a clip with the song on air and share it as a story, in a message, or to Instagram
- Discover artists and songs, then favorite and follow the music you want to hear again
- Play full songs on demand and build playlists with Pro Radio
- Message artists and other listeners
- Go live or step into the DJ booth when your account is approved
- Find studios and creatives on Pro Networx
- Buy songs and manage Pro Radio or Pro Networx inside the app
- Browse as a guest and sign in when you want to join in

Subscriptions renew automatically until you cancel in your App Store or Google Play account settings. Terms: https://pro-networx.com/terms
Privacy: https://pro-networx.com/privacy

## iOS keywords (100 characters)

radio,hip hop,rap,independent,artist,live,playlist,discover,music,DJ,stream,country,R&B

## What's new (1.0.99)

- Browse as a guest and sign in only when you vote, follow, or chat
- Record a clip of the song on air and share it as a story, in a message, or to Instagram
- Comments, 1 to 10 ratings, and report reasons on every radio song
- Share artist and Pro profiles, and those links open in the app
- Search as you type, with artist cards sorted by popularity, songs, or recent
- iPhone lock screen and Dynamic Island show mute and fire or pass votes
- A text code confirms each new sign-in
- Deleting your account can be undone by signing in within 48 hours

## Privacy nutrition labels (iOS)

| Data | Linked to user | Used for tracking |
| --- | --- | --- |
| Email address | Yes | No |
| Name | Yes | No |
| Phone number | Yes | No |
| User ID | Yes | No |
| Device ID (push token) | Yes | No |
| Photos or videos | Yes | No |
| Audio data | Yes | No |
| Other user content (messages, comments, posts) | Yes | No |
| Coarse location | Yes | No |
| Purchase history | Yes | No |
| Product interaction | Yes | No |
| Crash data | Only if the build sets `SENTRY_DSN` | No |

Tracking: No. Data is used for app functionality, not sold, and not used to track users across other companies' apps.

## Google Play Data safety

- Collects: name, email, phone number, user IDs, photos and videos, audio, messages, approximate location, purchase history, app interactions, push token
- Crash logs: only if the build sets `SENTRY_DSN` in `mobile/.env`
- Shared: with service providers that run the app (authentication, hosting, payments, text messages, crash reports). Not sold.
- Advertising ID: not collected. The Android manifest removes `AD_ID`. Declare **Contains ads: No**.
- Optional: camera and microphone only when the user records a clip or Discover video, goes live, or opens the DJ booth
- Users can delete their account inside the app; it is kept 48 hours and then permanently deleted
- Data is encrypted in transit

## Reviewer notes

Demo listener

- Email: reviewer@networxradio.com (create this account before submission)
- Password: set a one-time password and put it in App Store Connect notes, not in the repo
- Text-code verification: when it is active in production, each new sign-in texts a code to the account's verified mobile number. Verify the demo account with a number the review team can receive codes on, and explain how in the notes. There is no reviewer bypass.

Path to try

1. Tap **Continue as guest** to look around, or sign in with the demo account. Terms are accepted at sign-up.
2. Open Radio and let a station play. Swipe the artwork to change station. Use the ⋮ menu on the player to rate or report the song.
3. Open Discover, then a profile, and use the menu to Report or Block.
4. Settings → Account has Blocked accounts and Delete account. Settings → Legal and support has Privacy policy, Terms, Contact support, and Restore purchases.
5. Subscriptions are offered with Terms, Privacy, auto-renew text, and Manage subscription. There is no external checkout link on iOS or Android.

Sign in with Apple and Google are both available. Delete account is in Settings, Help & Legal, and at the bottom of My Profile; the user types delete to confirm. Store subscriptions must be cancelled in the store; the delete dialog says so.
