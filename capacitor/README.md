# Capacitor shell (replaces Flutter after PWA parity)

Wraps the Next.js PWA for native store distribution.

## Setup

```bash
cd capacitor
npm install
npx cap sync
```

## Plugins

- Push Notifications (FCM via Capacitor)
- Geolocation (Nearby People parity)
- Camera (profile / Discover video)

## Config

`capacitor.config.ts` points `server.url` at production PWA during dev;
for store builds, set `webDir` to static export output when enabled.

See `mobile/docs/web_mobile_parity_matrix.md` for acceptance criteria.
