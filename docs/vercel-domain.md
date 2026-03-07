# Vercel domain: networxradio.com

**Full production checklist:** See [production-networxradio.md](production-networxradio.md) for the complete networxradio.com setup (DNS, Vercel, Railway, Firebase, Stripe).

The main web app (in `web/`) is linked to the Vercel project **radi-oapp**. Production runs on **networxradio.com** and **www.networxradio.com** (both required).

## Add the domain in Vercel

1. Open [Vercel Dashboard](https://vercel.com) → **DiscoverMe Radio Group LLC** → project **radi-oapp**.
2. Go to **Settings** → **Domains**.
3. Click **Add** and add both (required):
   - `networxradio.com`
   - `www.networxradio.com`
4. Configure redirect in Vercel if desired (e.g. www to apex or apex to www).
5. Follow Vercel’s DNS instructions: add the A/CNAME records at your registrar (where networxradio.com is registered) as shown in the Dashboard.

## Environment variables

Set these so the app and backend use the correct URLs:

- **Vercel (radi-oapp project)**  
  - `NEXT_PUBLIC_WEB_URL` = `https://networxradio.com`  
  - `BACKEND_URL` or `NEXT_PUBLIC_API_URL` = your backend URL (e.g. Railway backend).

- **Backend (e.g. Railway)**  
  - `WEB_URL` = `https://networxradio.com`  
  - `CORS_ORIGIN` = `https://networxradio.com,https://www.networxradio.com` (both required).

After DNS propagates, the site will be served at **https://networxradio.com** and **https://www.networxradio.com**.

## Firebase "Unauthorized domain" on sign-in

If Google (or other) sign-in fails with **unauthorized domain**, add your app domains in Firebase: **Authentication → Settings → Authorized domains**. See [firebase-authorized-domains.md](./firebase-authorized-domains.md) for the exact list and steps.
