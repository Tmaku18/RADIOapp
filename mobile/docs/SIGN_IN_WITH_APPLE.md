# Sign in with Apple (web + iOS)

## Code (done in repo)

- **Web:** Continue with Apple on `/login` and `/signup` via Firebase `OAuthProvider('apple.com')`.
  - Tries `signInWithPopup` first; falls back to `signInWithRedirect` when the popup is blocked or closed (Safari / iOS).
  - Resume via `getRedirectResult` in `AuthContext`.
- **Mobile iOS:** **Continue with Apple** shows on iOS/macOS when `SignInWithApple.isAvailable()` is true. It uses a nonce + `rawNonce` Firebase credential and requests email and full name. `Runner.entitlements` includes Sign in with Apple.
- **First sign-in:** new Google/Apple users go to profile setup (display name and role) before the account is created. When text-code phone verification is active, every new sign-in also asks for a code.
- **Account deletion:** the app sends the Apple authorization code to `POST /api/users/me/apple-authorization`. When the account is permanently deleted (48 hours after the request), the backend revokes it at `https://appleid.apple.com/auth/revoke`. This needs `APPLE_TEAM_ID`, `APPLE_IAP_KEY_ID`, and `APPLE_IAP_PRIVATE_KEY` on the backend; without them revocation is skipped and logged.

## Firebase Console (required once)

1. Open [Firebase Console](https://console.firebase.google.com) → project **radioapp-4c14a**.
2. **Authentication** → **Sign-in method** → **Apple** → Enable.
3. For **web**, Apple requires a Services ID + key:
   - Apple Developer → **Identifiers** → **+** → **Services IDs**
   - Description: `Networx Radio Web`
   - Identifier: e.g. `com.tmaktechnologies.networxradio.web`
   - Enable **Sign In with Apple** → Configure:
     - Primary App ID: `com.tmaktechnologies.networxradio`
     - Domains (and subdomains as needed):
       - `networxradio.com`
       - `www.networxradio.com`
       - `pro-networx.com`
       - `www.pro-networx.com`
       - Firebase auth domain: `radioapp-4c14a.firebaseapp.com`
     - Return URL: `https://radioapp-4c14a.firebaseapp.com/__/auth/handler`
   - Apple Developer → **Keys** → **+** → enable **Sign In with Apple** → download `.p8`
   - In Firebase Apple provider settings, paste:
     - Services ID
     - Apple Team ID (`8QZ4S3G53V`)
     - Key ID
     - Private key contents from the `.p8`
4. **Authentication** → **Settings** → **Authorized domains** must include:
   - `networxradio.com`
   - `www.networxradio.com`
   - `pro-networx.com`
   - `www.pro-networx.com`
   - `localhost` (dev)

## Apple Developer App ID

App ID `com.tmaktechnologies.networxradio` has **Sign In with Apple** enabled (`com.apple.developer.applesignin` in `mobile/ios/Runner/Runner.entitlements`).

## Verify

1. Web (Chrome): open `/login` → **Continue with Apple** → Apple popup → session + `/dashboard` (or profile setup for new users).
2. Web (Safari): same flow may use a full-page redirect instead of a popup — still lands on `/dashboard` / profile setup.
3. Second Apple sign-in with “Hide My Email”: profile setup still completes (relay email placeholder).
4. iOS: run on a real device/simulator with Apple ID → **Continue with Apple** → profile setup for a new account, then the text code if verification is active.
5. iOS: delete a test account that signed in with Apple, wait out the 48 hours, and confirm the backend log shows no "Skipping Apple token revoke" warning.
