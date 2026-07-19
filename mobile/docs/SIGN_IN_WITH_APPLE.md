# Sign in with Apple (web + iOS)

## Code (done in repo)

- **Web:** Continue with Apple on `/login` and `/signup` via Firebase `OAuthProvider('apple.com')`.
- **Mobile iOS:** Apple button (when available), nonce + `rawNonce` Firebase credential, `Runner.entitlements` with Sign in with Apple.

## Firebase Console (required once)

1. Open [Firebase Console](https://console.firebase.google.com) → project **radioapp-4c14a**.
2. **Authentication** → **Sign-in method** → **Apple** → Enable.
3. For **web**, Apple requires a Services ID + key:
   - Apple Developer → **Identifiers** → **+** → **Services IDs**
   - Description: `Networx Radio Web`
   - Identifier: e.g. `com.tmaktechnologies.networxradio.web`
   - Enable **Sign In with Apple** → Configure:
     - Primary App ID: `com.tmaktechnologies.networxradio`
     - Domains: `networxradio.com`, `www.networxradio.com`, and your Firebase auth domain  
       (e.g. `radioapp-4c14a.firebaseapp.com`)
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
   - `localhost` (dev)

## Apple Developer App ID

App ID `com.tmaktechnologies.networxradio` must have **Sign In with Apple** enabled (you already planned this for App Store).

## Verify

1. Web: open `/login` → **Continue with Apple** → Apple popup → session + dashboard (or display-name gate for new users).
2. iOS: run on a real device/simulator with Apple ID → **Continue with Apple**.
