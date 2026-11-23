# Quick Setup Guide

For the full picture see [README.md](README.md). This page is the short checklist.

## Prerequisites

- Node.js 22+ and npm
- Flutter 3.38+ (Dart 3.10+), plus Xcode + CocoaPods (iOS) and/or Android Studio with SDK 35 and JDK 17 (Android)
- Docker (optional, for backend + Redis)

## 1. Accounts and keys

### Firebase
1. Use the Firebase project `radioapp-4c14a` (or create your own at https://console.firebase.google.com).
2. Enable Authentication providers: Email/Password, Google, and Apple.
3. Generate a service account key (Project settings → Service accounts → Generate new private key). Keep the JSON outside git.
4. Download the app configs for `com.tmaktechnologies.networxradio`: `google-services.json` → `mobile/android/app/`, `GoogleService-Info.plist` → `mobile/ios/Runner/`.

Details: [FIREBASE_QUICK_START.md](FIREBASE_QUICK_START.md).

### Supabase
1. Create a project at https://supabase.com and note the project URL, service role key, and anon key.
2. Apply the SQL files in `backend/supabase/migrations/` in order (SQL editor, Supabase MCP, or `npx ts-node backend/scripts/apply-supabase-migrations.ts` from the repo root with `DATABASE_URL` set). Migrations also create the storage buckets.

### Stripe (web payments)
1. Get API keys from Dashboard → Developers → API keys.
2. Add a webhook endpoint at `https://<backend-host>/api/payments/webhook` with these events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.updated`, `customer.subscription.deleted`, `account.updated`, `setup_intent.succeeded`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Subscription prices: see `docs/runbooks/` (Pro-Radio, Pro-Networx, Pro bundle).

Mobile purchases use App Store and Google Play billing; see [backend/ENV_REQUIREMENTS.md](backend/ENV_REQUIREMENTS.md).

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in Firebase, Supabase, Stripe
npm run start:dev
```

Backend runs on http://localhost:3000 (routes under `/api`, health at `/api/health`).

### Or with Docker (backend + Redis)

```bash
cp .env.example .env   # repo root; Compose reads this file
docker compose up -d redis backend
```

Place the Firebase service-account JSON at the path mounted in `docker-compose.yml` (`docs/radioapp-4c14a-firebase-adminsdk-*.json`, gitignored). On Windows, run this from WSL or Docker Desktop.

## 3. Web

```bash
cd web
npm install
npm run dev
```

Web runs on http://localhost:3001. Set env in `web/.env.local` (see [web/README.md](web/README.md)).

## 4. Mobile

```bash
cd mobile
flutter pub get
cp .env.example .env
flutter run
```

To hit a local backend, set both `API_DIRECT_URL` and `API_BASE_URL` in `mobile/.env`:
- Android emulator: `http://10.0.2.2:3000`
- Physical device: your machine's LAN IP, e.g. `http://192.168.1.x:3000`

Without `API_DIRECT_URL`, the app goes to the production Railway backend first.

## 5. Admin dashboard (standalone, optional)

```bash
cd admin
npm install
# create .env.local (see admin/README.md)
npm run dev -- -p 3002
```

Most admin tools live in the web app at http://localhost:3001/admin.

## Testing the application

1. **Sign up** as an artist (web or mobile), then verify your phone with the text code. Without Twilio configured locally, the code is printed in the backend log.
2. **Upload a song** from My Songs / Upload.
3. **Approve it**: as an admin, open `/admin/songs` on the web (or set `status = 'approved'` in Supabase).
4. **Buy placements** for the song (web uses Stripe test card `4242 4242 4242 4242`), or set `BETA_ALL_FREE=true` in the backend to skip payment.
5. **Listen**: open the Radio player and vote with fire / poop.

To make yourself an admin, set `role = 'admin'` on your row in the `users` table or add your email to `ADMIN_EMAILS`.

## Notion (NetworX OS)

Business and engineering planning live in the **NetworX Notion OS**. See [`docs/notion/networx-workspace.md`](docs/notion/networx-workspace.md). Legacy RadioApp workspace: [`docs/notion/notion-workspace-created.md`](docs/notion/notion-workspace-created.md).

## Important notes

- Songs must be approved (`status = 'approved'`) before they enter rotation.
- Placement budget is stored per song (`songs.credits_remaining`); artists buy placements per song.
- The Stripe webhook URL must be publicly reachable; for local testing use the Stripe CLI (`stripe listen --forward-to localhost:3000/api/payments/webhook`) or a tunnel such as ngrok.
