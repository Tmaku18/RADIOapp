# Vercel domain: networxradio.com

The main web app (in `web/`) is linked to the Vercel project **radi-oapp**. The production domain is **networxradio.com**.

## Add the domain in Vercel

1. Open [Vercel Dashboard](https://vercel.com) → **DiscoverMe Radio Group LLC** → project **radi-oapp**.
2. Go to **Settings** → **Domains**.
3. Click **Add** and add:
   - `networxradio.com`
   - `www.networxradio.com` (optional; you can redirect to apex or vice versa).
4. Follow Vercel’s DNS instructions: add the A/CNAME records at your registrar (where networxradio.com is registered) as shown in the Dashboard.

## Environment variables

Set these so the app and backend use the correct URLs:

- **Vercel (radi-oapp project)**  
  - `NEXT_PUBLIC_WEB_URL` = `https://networxradio.com`  
  - `BACKEND_URL` or `NEXT_PUBLIC_API_URL` = your backend URL (e.g. Railway backend).

- **Backend (e.g. Railway)**  
  - `WEB_URL` = `https://networxradio.com`  
  - `CORS_ORIGIN` = include `https://networxradio.com` and `https://www.networxradio.com` if you use www.

After DNS propagates, the site will be served at **https://networxradio.com**.
