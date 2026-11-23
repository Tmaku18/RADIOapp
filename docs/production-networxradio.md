# Production checklist: networxradio.com + pro-networx.com

Official production setup. The web app (one Next.js project in `web/`) is on Vercel and answers on **www.networxradio.com** (NETWORX Radio) and **www.pro-networx.com** (Pro-Networx). The apex domains redirect to www. The backend is on Railway.

For copy-paste env blocks (with placeholders), use [deploy-railway-vercel-namecheap.md](deploy-railway-vercel-namecheap.md). Fill secrets in the Vercel/Railway Dashboards.

---

## 1. DNS (registrar)

At the registrar for each domain, add the records Vercel shows in **Settings → Domains**:

- **A** for `networxradio.com` → Vercel apex IP
- **CNAME** for `www.networxradio.com` → Vercel target
- **A** for `pro-networx.com` → Vercel apex IP
- **CNAME** for `www.pro-networx.com` → Vercel target

All four hosts are required.

---

## 2. Vercel (radi-oapp)

**Dashboard:** [Vercel](https://vercel.com) → **DiscoverMe Radio Group LLC** → project **radi-oapp**.

### Domains (Settings → Domains)

Add all four:

- `networxradio.com` → redirect to `www.networxradio.com`
- `www.networxradio.com`
- `pro-networx.com` → redirect to `www.pro-networx.com`
- `www.pro-networx.com`

`web/src/middleware.ts` handles the Pro-Networx host: `/` redirects to `/pro-networx`, `/dashboard` to `/pro-networx/directory`, and `/profile` to `/pro-networx/onboarding`. Old `/job-board` and `/artist/services` links redirect to `/pro-networx/jobs` and `/pro-networx/directory` on either host.

### Environment variables (Settings → Environment Variables)

Set for **Production** (and Preview if you want):

| Variable | Value |
|---------|--------|
| `BACKEND_URL` | Railway backend URL, currently **`https://backend-production-17cc.up.railway.app`** (no trailing slash). Or `https://api.networxradio.com` if using a custom API domain. `/api/*` is rewritten to this host. |
| `NEXT_PUBLIC_API_URL` | Same as `BACKEND_URL` |
| `ANDROID_APP_LINK_SHA256` | Play App Signing SHA-256 (comma-separated for several). Feeds `/.well-known/assetlinks.json`. |
| `NEXT_PUBLIC_SITE_URL` | Optional. Canonical Radio origin; defaults to `https://www.networxradio.com`. |
| `NEXT_PUBLIC_PRO_NETWORX_APP_URL` | Optional. Pro-Networx origin; defaults to `https://www.pro-networx.com`. |

Plus Firebase (`NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_KEY`) and Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) from [env-variables-setup.md](env-variables-setup.md).

Redeploy after changing variables.

---

## 3. Railway (backend)

**Dashboard:** [Railway](https://railway.app) → **RadioApp** → **backend** → **Variables**.

| Variable | Value |
|---------|--------|
| `WEB_URL` | `https://www.networxradio.com` |
| `CORS_ORIGIN` | Optional extra origins. `backend/src/main.ts` always allows `https://www.networxradio.com`, `https://networxradio.com`, `https://www.pro-networx.com`, and `https://pro-networx.com`. |
| `BETA_ALL_FREE` | `false` for paid launch (code default is `false`) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Required for sign-in text codes. Production enforces phone verification only when all three are set. |

Set all other backend variables per [railway-setup.md](railway-setup.md) and [env-variables-setup.md](env-variables-setup.md).

---

## 4. Firebase authorized domains

**Console:** [Firebase](https://console.firebase.google.com/) → project **radioapp-4c14a** → **Authentication** → **Settings** → **Authorized domains**.

Add (required for production):

- `networxradio.com`
- `www.networxradio.com`
- `pro-networx.com`
- `www.pro-networx.com`

Also add any Vercel preview hostnames if you need sign-in on preview deployments. See [firebase-authorized-domains.md](firebase-authorized-domains.md).

---

## 5. Stripe and store billing

- **Redirect URLs:** The backend builds default success/cancel URLs from `WEB_URL`; the web app usually sends its own.
- **Webhook:** In Stripe Dashboard → Developers → Webhooks, the endpoint URL must point at the **backend**: `https://<railway-host>/api/payments/webhook` (or `https://api.networxradio.com/api/payments/webhook` with a custom API domain). Event list: [deploy-railway-vercel-namecheap.md](deploy-railway-vercel-namecheap.md#42-stripe).
- **App Store / Google Play:** iOS and Android purchases go through store billing. Point App Store Server Notifications V2 at `/api/payments/app-store/notifications` and Google Play RTDN at `/api/payments/google-play/rtdn` on the backend host.

---

## 6. App links

The web app serves `/.well-known/apple-app-site-association` (iOS Universal Links) and `/.well-known/assetlinks.json` (Android App Links) from route handlers in `web/src/app/.well-known/`. Shared artist links use `https://www.networxradio.com/open/artists/:id`; the page loads for guests and offers **Open in the NetworX app**.

---

## 7. Verification

1. Open **https://www.networxradio.com** and **https://www.pro-networx.com** — both serve the app. The apex hosts redirect to www.
2. `https://www.networxradio.com/api/health` and `https://backend-production-17cc.up.railway.app/api/health` both return `"status": "ok"`.
3. Sign in (e.g. Google) on both domains. If Twilio is configured, a new sign-in asks for the text code.
4. Use chat and any API-backed feature — in DevTools → Network, `/api/*` requests succeed.
5. `curl -s https://www.networxradio.com/.well-known/assetlinks.json` shows a non-empty `sha256_cert_fingerprints`.
6. If you use payments, run a test checkout and confirm redirects and webhook.

---

## Optional: Custom API domain (api.networxradio.com)

To serve the API under the same domain (no `*.railway.app` in production):

1. **Railway:** Backend service → **Settings** → **Domains** → add custom domain `api.networxradio.com`. Note the CNAME target.
2. **DNS:** At your registrar, add **CNAME** `api` → Railway's target.
3. **Vercel:** Set `BACKEND_URL` and `NEXT_PUBLIC_API_URL` to `https://api.networxradio.com`.
4. **Stripe:** Set (or update) webhook URL to `https://api.networxradio.com/api/payments/webhook`. Update the store notification URLs the same way.
5. **Railway:** No change to `WEB_URL` or `CORS_ORIGIN`.

After DNS propagates, the API is available at **https://api.networxradio.com**.
