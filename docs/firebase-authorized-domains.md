# Firebase: Fix "Unauthorized domain" (Google Sign-in)

When you see **unauthorized domain** during Google (or other) sign-in, the app’s domain is not in Firebase’s **Authorized domains** list. Add it as follows.

## Steps

1. Open **[Firebase Console](https://console.firebase.google.com/)** and select project **radioapp-4c14a**.
2. Go to **Authentication** (left sidebar) → **Settings** tab → **Authorized domains** section.
3. Click **Add domain** and add each domain where the app runs:

   | Domain | When to add |
   |--------|---------------------|
   | `networxradio.com` | Production (main site) |
   | `www.networxradio.com` | If you use www |
   | `localhost` | Already there; used for local dev |
   | `radi-oapp-discover-me-radio-group-llc.vercel.app` | Vercel production hostname |
   | `radi-oapp-*.vercel.app` | Not supported (no wildcards). Add the **exact** preview URL if you need to sign in on a preview deployment (e.g. `radi-oapp-8xjq10sao-discover-me-radio-group-llc.vercel.app`). |

4. Save. Sign-in (including Google) will work from those domains after a short delay.

## Quick list (copy-paste)

Add these in **Authentication → Settings → Authorized domains**:

- `networxradio.com`
- `www.networxradio.com`
- `radi-oapp-discover-me-radio-group-llc.vercel.app`

If you use other Vercel URLs (e.g. a custom branch URL), add the full hostname (e.g. `radi-oapp-git-main-discover-me-radio-group-llc.vercel.app`).
