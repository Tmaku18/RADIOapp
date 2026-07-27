# Firebase: Fix "Unauthorized domain" (Google Sign-in)

When you see **unauthorized domain** during Google (or other) sign-in, the app’s domain is not in Firebase’s **Authorized domains** list. Add it as follows.

## Steps

1. Open **[Firebase Console](https://console.firebase.google.com/)** and select project **radioapp-4c14a**.
2. Go to **Authentication** (left sidebar) → **Settings** tab → **Authorized domains** section.
3. Click **Add domain** and add each domain where the app runs:

   | Domain | When to add |
   |--------|---------------------|
   | `networxradio.com` | Production (apex) |
   | `www.networxradio.com` | Production (www; required) |
   | `pro-networx.com` | Pro-Networx production (apex) |
   | `www.pro-networx.com` | Pro-Networx production (www; required) |
   | `localhost` | Already there; used for local dev |
   | `radi-oapp-discover-me-radio-group-llc.vercel.app` | Vercel production hostname |
   | `radi-oapp-*.vercel.app` | Not supported (no wildcards). Add the **exact** preview URL if you need to sign in on a preview deployment (e.g. `radi-oapp-8xjq10sao-discover-me-radio-group-llc.vercel.app`). |

4. Save. Sign-in (including Google and Apple) will work from those domains after a short delay.

For **Sign in with Apple**, the same hosts must also be listed on the Apple Services ID (see `mobile/docs/SIGN_IN_WITH_APPLE.md`). Apple’s return URL stays:

`https://radioapp-4c14a.firebaseapp.com/__/auth/handler`

## Quick list (copy-paste)

Add these in **Authentication → Settings → Authorized domains**:

- `networxradio.com`
- `www.networxradio.com`
- `pro-networx.com`
- `www.pro-networx.com`
- `radi-oapp-discover-me-radio-group-llc.vercel.app`

If you use other Vercel URLs (e.g. a custom branch URL), add the full hostname (e.g. `radi-oapp-git-main-discover-me-radio-group-llc.vercel.app`).
