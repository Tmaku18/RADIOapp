# Backend Setup Complete ✅

The backend has been successfully set up and is ready for configuration.

## What's Been Done

1. ✅ Dependencies installed (`npm install`)
2. ✅ TypeScript compilation verified (`npm run build`)
3. ✅ All modules and services created
4. ✅ Type errors fixed

## Next Steps: Environment Configuration

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

## How to Get Your Credentials

### Firebase
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Settings > Service Accounts
4. Click "Generate New Private Key"
5. Copy the values from the downloaded JSON file

### Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings > API
4. Copy the "Project URL" and "service_role" key (not the anon key!)

### Stripe
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to Developers > API keys
3. Copy your Secret key (starts with `sk_test_` or `sk_live_`)
4. For webhook secret: Go to Developers > Webhooks
5. Create endpoint: `https://your-domain.com/api/payments/webhook`
6. Select event: `payment_intent.succeeded`
7. Copy the signing secret (starts with `whsec_`)

## Running the Backend

Once your `.env` file is configured:

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000` (or the PORT you specified).

## Testing the Setup

1. Start the server: `npm run start:dev`
2. Check health: Visit `http://localhost:3000/api` (should return "Hello World!")
3. Test auth: `GET http://localhost:3000/api/auth/verify` (requires Firebase token)

## Database Setup Required

Before the backend can fully function, you need to:

1. Run the SQL from `docs/database-schema.md` in your Supabase SQL Editor
2. Create storage buckets:
   - `songs` bucket (public) for audio files
   - `artwork` bucket (public) for album artwork

## Troubleshooting

### Build Errors
- If you see TypeScript errors, run `npm run build` to see details
- Make sure all dependencies are installed: `npm install`

### Runtime Errors
- Check that all environment variables are set correctly
- Verify Firebase service account key format (must include `\n` for newlines)
- Ensure Supabase URL and keys are correct
- Check that database tables exist

### Port Already in Use
- Change `PORT` in `.env` to a different port (e.g., 3001)
- Or stop the process using port 3000

## API Endpoints

Once running, the API will be available at:
- Base URL: `http://localhost:3000/api`
- Auth: `/api/auth/verify`
- Users: `/api/users/*`
- Songs: `/api/songs/*`
- Radio: `/api/radio/*`
- Payments: `/api/payments/*`
- Credits: `/api/credits/*`

See `docs/api-spec.md` for full API documentation.
