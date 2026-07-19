# Environment Variables Requirements

## Required for Server Startup

The following environment variables are **required** for the backend to start:

### Firebase (Required)
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Service account private key (with `\n` for newlines)
- `FIREBASE_CLIENT_EMAIL` - Service account client email

**Why:** Firebase Admin SDK is initialized at startup in `main.ts` for authentication.

### Supabase (Required)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key (not anon key!)

**Why:** Supabase client is initialized at startup. Missing values will throw an error.

### Stripe (Required)
- `STRIPE_SECRET_KEY` - Stripe secret API key (starts with `sk_test_` or `sk_live_`)

**Why:** StripeService is instantiated when PaymentsModule loads, which happens at startup.

## Optional (Have Defaults)

- `PORT` - Server port (defaults to 3000)
- `CORS_ORIGIN` - Comma-separated allowed origins (defaults to '*')
- `NODE_ENV` - Environment mode (defaults to undefined)

## Conditionally Required

- `STRIPE_WEBHOOK_SECRET` - Only needed if you're using the webhook endpoint (`/api/payments/webhook`)

## Testing Checklist

To test if your .env is sufficient:

1. ✅ All 6 required variables are set
2. ✅ Firebase credentials are valid (will fail if invalid format)
3. ✅ Supabase URL and key are correct (will fail if wrong)
4. ✅ Stripe key is valid (will fail if invalid)

## Quick Test

Run this to see if server starts:
```bash
npm run start:dev
```

If you see:
- ✅ "Application is running on: http://localhost:3000" → Success!
- ❌ Error about missing env var → Add the missing variable
- ❌ Error about invalid credentials → Check your credentials

## What You Can Test Without Full Setup

Even with minimal setup, you can test:
- ✅ Server starts and responds
- ✅ Health check endpoint: `GET /api`
- ❌ Auth endpoints (need valid Firebase)
- ❌ Database operations (need valid Supabase + database tables)
- ❌ Payment operations (need valid Stripe)

## Minimum Viable Test

To do a basic smoke test:
1. Set all 6 required env vars (can use dummy values for Stripe if not testing payments)
2. Start server: `npm run start:dev`
3. Test: `curl http://localhost:3000/api` (should return "Hello World!")

For full functionality, you also need:
- Database tables created (run SQL from `docs/database-schema.md`)
- Storage buckets created in Supabase
- Valid Firebase project with Authentication enabled
