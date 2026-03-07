# Production checklist: networxradio.com

Official production setup so the app runs only through **networxradio.com** and **www.networxradio.com**. Web app is on Vercel; backend is on Railway.

For copy-paste env values (with placeholders), use [env-variables.local](env-variables.local). Fill secrets in Vercel/Railway Dashboards.

---

## 1. DNS (registrar)

At the registrar where **networxradio.com** is registered, add the records Vercel shows in **Settings → Domains**:

- **A** (or **CNAME**) for `networxradio.com` → Vercel target
- **CNAME** for `www.networxradio.com` → Vercel target

Both apex and www are required for official production.

---

## 2. Vercel (radi-oapp)

**Dashboard:** [Vercel](https://vercel.com) → **DiscoverMe Radio Group LLC** → project **radi-oapp**.

### Domains (Settings → Domains)

Add both (required):

- `networxradio.com`
- `www.networxradio.com`

Configure redirect if desired (e.g. www → apex or apex → www) in Vercel Domains.

### Environment variables (Settings → Environment Variables)

Set for **Production** (and Preview if you want):

| Variable | Value |
|---------|--------|
| `NEXT_PUBLIC_WEB_URL` | `https://networxradio.com` |
| `BACKEND_URL` | Your Railway backend URL (e.g. `https://backend-xxx.up.railway.app`) or `https://api.networxradio.com` if using custom API domain |
| `NEXT_PUBLIC_API_URL` | Same as `BACKEND_URL` |

Plus all other vars from [env-variables-setup.md](env-variables-setup.md) (Firebase, Supabase, Stripe, etc.).

Redeploy after changing variables.

---

## 3. Railway (backend)

**Dashboard:** [Railway](https://railway.app) → **RadioApp** → **backend** → **Variables**.

| Variable | Value |
|---------|--------|
| `WEB_URL` | `https://networxradio.com` |
| `CORS_ORIGIN` | `https://networxradio.com,https://www.networxradio.com` |

Both origins are required so requests from apex and www are allowed.

Set all other backend variables per [railway-setup.md](railway-setup.md) and [env-variables-setup.md](env-variables-setup.md).

---

## 4. Firebase authorized domains

**Console:** [Firebase](https://console.firebase.google.com/) → project **radioapp-4c14a** → **Authentication** → **Settings** → **Authorized domains**.

Add (required for production):

- `networxradio.com`
- `www.networxradio.com`

Also add any Vercel preview hostnames if you need sign-in on preview deployments. See [firebase-authorized-domains.md](firebase-authorized-domains.md).

---

## 5. Stripe

- **Redirect URLs:** The backend builds success/cancel URLs from `WEB_URL`, so no change needed as long as Railway has `WEB_URL=https://networxradio.com`.
- **Webhook:** In Stripe Dashboard → Developers → Webhooks, the endpoint URL must point at your **backend** (e.g. `https://<railway-host>/api/payments/webhook` or `https://api.networxradio.com/api/payments/webhook` if using custom API domain). Create or update the webhook to use the correct backend URL.

---

## 6. Verification

1. Open **https://networxradio.com** and **https://www.networxradio.com** — both should serve the app.
2. Sign in (e.g. Google) — should work on both domains.
3. Use chat and any API-backed feature — in DevTools → Network, `/api/*` should go to the backend and succeed.
4. If you use payments, run a test checkout and confirm redirects and webhook.

---

## Optional: Custom API domain (api.networxradio.com)

To serve the API under the same domain (no `*.railway.app` in production):

1. **Railway:** Backend service → **Settings** → **Domains** → add custom domain `api.networxradio.com`. Note the CNAME target.
2. **DNS:** At your registrar, add **CNAME** `api` → Railway’s target.
3. **Vercel:** Set `BACKEND_URL` and `NEXT_PUBLIC_API_URL` to `https://api.networxradio.com`.
4. **Stripe:** Set (or update) webhook URL to `https://api.networxradio.com/api/payments/webhook`.
5. **Railway:** No change to `WEB_URL` or `CORS_ORIGIN` (already networxradio.com).

After DNS propagates, the API will be available at **https://api.networxradio.com**.
