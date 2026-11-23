# Backend Setup

Steps to get the NestJS backend running locally. For the module overview see [README.md](README.md); for every env var see [ENV_REQUIREMENTS.md](ENV_REQUIREMENTS.md).

## 1. Install and build

```bash
cd backend
npm install
npm run build   # optional: confirms TypeScript compiles
```

Use Node.js 22+.

## 2. Environment configuration

Copy `.env.example` to `.env` in `backend/` and fill in at least:

```env
# Firebase Admin SDK — preferred: path to the service account JSON
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/service-account.json
# or the three fields from that JSON
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Server
PORT=3000
NODE_ENV=development
WEB_URL=http://localhost:3001

# Optional
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3001
```

## How to Get Your Credentials

### Firebase
1. Go to [Firebase Console](https://console.firebase.google.com) and select the project (`radioapp-4c14a`)
2. Project settings > Service accounts
3. Click "Generate new private key"
4. Save the JSON outside git and point `FIREBASE_SERVICE_ACCOUNT_PATH` at it, or copy its fields into the three `FIREBASE_*` variables (see [FIREBASE_KEY_FORMAT.md](FIREBASE_KEY_FORMAT.md))

### Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Project Settings > API
4. Copy the Project URL and the `service_role` key (the anon key is for clients only)

### Stripe
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Developers > API keys: copy the Secret key (`sk_test_` or `sk_live_`)
3. Developers > Webhooks: create an endpoint at `https://your-backend-host/api/payments/webhook`
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.updated`, `customer.subscription.deleted`, `account.updated`, `setup_intent.succeeded`
5. Copy the signing secret (`whsec_`) into `STRIPE_WEBHOOK_SECRET`

For local webhook testing: `stripe listen --forward-to localhost:3000/api/payments/webhook`.

## 3. Database setup

1. Apply the SQL files in `supabase/migrations/` in order. From the repo root with `DATABASE_URL` set:
   ```bash
   npx ts-node backend/scripts/apply-supabase-migrations.ts
   ```
   You can also paste them into the Supabase SQL Editor.
2. Migrations create the storage buckets (`songs`, `artwork`, `avatars`, `feed`, `portfolio`, `resumes`, `dm-media`, `dj-soundboard`) and their policies.

## Running the Backend

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The server starts on `http://localhost:3000` (or `PORT`) and logs `Application is running on: http://localhost:3000`.

To run with Redis in Docker instead, use `docker compose up -d redis backend` from the repo root (see the root README).

## Testing the Setup

1. Start the server: `npm run start:dev`
2. `GET http://localhost:3000/api` returns `Hello World!`
3. `GET http://localhost:3000/api/health` returns `{"status":"ok",…}` when Supabase is reachable
4. `GET http://localhost:3000/api/auth/verify` with a Firebase ID token returns your role

## Troubleshooting

### Build Errors
- Run `npm run build` to see TypeScript errors
- Reinstall dependencies: `npm install`

### Runtime Errors
- Check that all required environment variables are set
- Firebase key: use `FIREBASE_SERVICE_ACCOUNT_PATH`, or keep `\n` escapes in `FIREBASE_PRIVATE_KEY`
- Ensure the Supabase URL and service key are correct and migrations are applied
- Realtime station events silently missing: upgrade to Node 22+
- Clip trims or transcodes failing: install ffmpeg or set `FFMPEG_PATH`

### Phone verification codes
Without Twilio credentials in development, the sign-in text code is logged by the backend instead of sent.

### Port Already in Use
- Change `PORT` in `.env`, or stop the process using port 3000 (the web app uses 3001)

## API Endpoints

Once running, the API is available at:
- Base URL: `http://localhost:3000/api`
- Health: `/api/health`
- Auth: `/api/auth/*`
- Users: `/api/users/*`
- Songs: `/api/songs/*`
- Radio: `/api/radio/*`
- Payments: `/api/payments/*`

Run `npm run test:routes:inventory` for the full route list, and see `../docs/api-spec.md` for documentation.
