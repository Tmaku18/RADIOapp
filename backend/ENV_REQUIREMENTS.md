# Environment Variables Requirements

Every variable below is read in `backend/src` through `process.env` or `ConfigService`. Template: `backend/.env.example`.

## Required for Server Startup

### Firebase (Required)
Either:
- `FIREBASE_SERVICE_ACCOUNT_PATH` - Path to the service account JSON (preferred; used by Docker Compose)

Or all three:
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Service account client email
- `FIREBASE_PRIVATE_KEY` - Service account private key (with `\n` for newlines; see [FIREBASE_KEY_FORMAT.md](FIREBASE_KEY_FORMAT.md))

**Why:** Firebase Admin is initialized in `main.ts` for auth and FCM.

### Supabase (Required)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key (not the anon key)

**Why:** The Supabase client is initialized in `main.ts`; missing values throw.

### Stripe (Required)
- `STRIPE_SECRET_KEY` - Stripe secret API key (`sk_test_` or `sk_live_`)

**Why:** `StripeService` throws in its constructor when the key is missing, and PaymentsModule loads at startup.

## Server & URLs (optional, have defaults)

| Variable | Default / notes |
|----------|-----------------|
| `PORT` | `3000` |
| `NODE_ENV` | `production` enables JSON logs and stops logging sign-in codes to the console |
| `CORS_ORIGIN` | Comma-separated extra origins. networxradio.com, pro-networx.com (with and without `www`), and `http://localhost:*` are always allowed |
| `WEB_URL` | Public web origin for Stripe redirects and links (default `http://localhost:3001`) |
| `WEB_APP_URL` | Web origin used by discovery share links |
| `SUPPORT_EMAIL` | Support contact in live-services emails |
| `ADMIN_EMAILS` | Comma-separated; these accounts are promoted to `admin` on sign-in and receive admin emails |
| `DATABASE_URL` | Direct Postgres connection for queries that bypass PostgREST and for `scripts/apply-supabase-migrations.ts` |
| `REDIS_URL` | Shared radio state, listener counts, emoji aggregation, and the BullMQ push queue. Without it the backend runs single-instance in memory and scheduled pushes are off |
| `SENTRY_DSN` | Error reporting |
| `FFMPEG_PATH` | ffmpeg binary for clip trims and transcodes (defaults to system ffmpeg) |

## Conditionally Required

- `STRIPE_WEBHOOK_SECRET` - Needed for `/api/payments/webhook` (signature verification throws without it)

### Phone verification (Twilio)
| Variable | Notes |
|----------|-------|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Sends sign-in text codes. Outside production without them, codes are logged by the backend. In production, phone verification is enforced only when all three are set |
| `MFA_CODE_PEPPER` | Hash pepper for codes (falls back to `SUPABASE_SERVICE_KEY`) |

### Stripe products (web)
| Variable | Notes |
|----------|-------|
| `STRIPE_PUBLISHABLE_KEY` | Returned to clients that open a Stripe Payment Sheet |
| `STRIPE_PRO_RADIO_PRICE_ID`, `STRIPE_PRO_RADIO_INTRO_COUPON_ID` | Pro-Radio subscription |
| `STRIPE_PRO_NETWORX_PRICE_ID`, `STRIPE_PRO_NETWORX_INTRO_COUPON_ID` | Pro-Networx subscription |
| `STRIPE_PRO_BUNDLE_PRICE_ID` | Pro bundle subscription |
| `STRIPE_CREATOR_NETWORK_PRICE_ID` | Creator Network subscription |
| `SONG_PRICE_CENTS` | Default song sale price |
| `SONG_SALE_PLATFORM_FEE_BPS` | Platform fee on song sales (basis points) |

Setup runbooks: `docs/runbooks/pro-radio-stripe.md`, `pro-networx-stripe.md`, `pro-bundle-stripe.md`.

## Mobile store IAP (App Store + Google Play)

Required for verifying mobile digital purchases (placements, song and beat sales, subscriptions, Refinery submissions, tips):

| Variable | Notes |
|----------|--------|
| `APPLE_IAP_BUNDLE_ID` | `com.tmaktechnologies.networxradio` |
| `APPLE_IAP_ENVIRONMENT` | `Sandbox` (TestFlight) or `Production` |
| `APPLE_APP_APPLE_ID` | Numeric App Store Connect app id (required for Production JWS verify) |
| `APPLE_IAP_KEY_ID` | App Store Connect → Integrations → In-App Purchase key |
| `APPLE_IAP_ISSUER_ID` | Same key's Issuer ID |
| `APPLE_IAP_PRIVATE_KEY` | `.p8` PEM (`\n` escaped) |
| `APPLE_IAP_ROOT_CERTS_DIR` | Optional directory of Apple root certificates |
| `APPLE_TEAM_ID` | Used with the App Store key to revoke Sign in with Apple tokens on account deletion |
| `GOOGLE_PLAY_PACKAGE_NAME` | `com.tmaktechnologies.networxradio` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Optional if `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` already have Android Publisher access |
| `STREAM_DONATIONS_ENABLED` | `true` to allow livestream tips |

Webhook URLs (configure in store consoles):

- App Store Server Notifications V2 → `https://backend-production-17cc.up.railway.app/api/payments/app-store/notifications`
- Google Play RTDN → `https://backend-production-17cc.up.railway.app/api/payments/google-play/rtdn`

Product catalog defaults ship in code (`src/payments/iap-product-catalog.ts`). Optional overrides: `APPLE_IAP_PRODUCT_CATALOG_JSON` / `GOOGLE_PLAY_PRODUCT_CATALOG_JSON`.

## Feature switches

| Variable | Default | Effect |
|----------|---------|--------|
| `BETA_ALL_FREE` | `false` | `true` unlocks paid features for a free test window |
| `PRO_NETWORX_MESSAGING_BETA_FREE` | `true` | `false` re-enables the paid Pro-Networx DM gate |
| `REFINERY_FREE_SUBMISSIONS` | follows `BETA_ALL_FREE` | `false` requires the Refinery submission fee |
| `BETA_AUTO_FREE_ROTATION` | `false` | `true` auto-approves new uploads into free rotation, skipping admin review |
| `ARTIST_LIVE_ENABLED` | `false` | `true` enables artist self-serve livestreams |
| `STREAM_ADS_TRACKING_ENABLED` | `false` | Livestream ad tracking |
| `COPYRIGHT_CHECK_ENABLED` | `true` | ACRCloud checks on upload (needs ACRCloud keys) |
| `IMAGE_MODERATION_ENABLED` | `true` | Google Vision checks on images (needs API key) |
| `FEATURE_CROSSFADE_MS`, `FEATURE_DEGRADED_PLAYBACK`, `FEATURE_WEEKLY_DIGEST` | code defaults | Values served by `GET /api/flags` |

## Radio tuning

| Variable | Default | Notes |
|----------|---------|-------|
| `THRESHOLD_ENTER_PAID` / `THRESHOLD_EXIT_PAID` | `5` / `3` | Listener counts that switch free ↔ paid mode |
| `CHECKPOINT_INTERVAL` | `5` | Songs between Redis → Supabase state checkpoints |
| `LISTENER_HEARTBEAT_ACTIVE_WINDOW_SECONDS` | `120` | Presence window for listener counts |
| `RADIO_BACKGROUND_POLL_MS` | `45000` | Background rotation timer; `<= 0` disables |
| `RADIO_ENDPOINT_TIMEOUT_MS` | `8000` | Timeout for radio endpoints |
| `RADIO_JINGLE_URL` | unset | Audio played when a station queue is empty |
| `TRIAL_BY_FIRE_START_UTC`, `TRIAL_BY_FIRE_DURATION_MIN` | off | Daily Trial by Fire window (`HH:MM` UTC start) |

## Integrations (optional)

| Variable | Service |
|----------|---------|
| `ELEVENLABS_API_KEY`, `ELEVENLABS_STT_MODEL_ID` | Synced lyrics alignment + transcription (`scribe_v1` default model) |
| `ACRCLOUD_HOST`, `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_ACCESS_SECRET`, `COPYRIGHT_MATCH_THRESHOLD` | Copyright detection |
| `GOOGLE_VISION_API_KEY` | Image moderation |
| `EMAIL_PROVIDER` (`sendgrid` / `resend`; default logs to console), `EMAIL_FROM`, `SENDGRID_API_KEY`, `RESEND_API_KEY` | Email |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN` (or `CLOUDFLARE_API_TOKEN`), `CLOUDFLARE_STREAM_CUSTOMER_CODE`, `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET` | Live streaming |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`, `R2_BUCKET_PUBLIC`, `R2_BUCKET_SONGS`, `R2_BUCKET_ARTWORK`, `R2_BUCKET_AVATARS`, `R2_BUCKET_FEED` | Mirror new media to Cloudflare R2 |

## Testing Checklist

To test if your `.env` is sufficient:

1. ✅ Firebase credentials set (path or the three fields)
2. ✅ `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` set and migrations applied
3. ✅ `STRIPE_SECRET_KEY` set (a test key is fine)

## Quick Test

```bash
npm run start:dev
```

If you see:
- ✅ "Application is running on: http://localhost:3000" → Success!
- ❌ Error about missing env var → Add the missing variable
- ❌ Error about invalid credentials → Check your credentials

## What You Can Test Without Full Setup

With only the required variables:
- ✅ Server starts and responds: `curl http://localhost:3000/api` returns `Hello World!`
- ✅ `GET /api/health` reports Supabase status
- ✅ Public radio endpoints (`GET /api/radio/current`)
- ❌ Authenticated endpoints need a valid Firebase project and, for most routes, phone verification
- ❌ Payment flows need valid Stripe or store credentials
