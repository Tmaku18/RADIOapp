# Radio Streaming Platform

A full-stack radio streaming platform that democratizes music discovery by allowing underground and independent artists to upload their music and pay for airplay, while listeners enjoy a continuous, curated stream of fresh tracks.

## Purpose & Vision

### The Problem
Independent artists struggle to get their music heard through traditional channels. Radio stations are dominated by major labels, and streaming platforms bury new artists in algorithms. This platform bridges that gap by creating a pay-to-play model where artists can directly purchase airtime, ensuring their music reaches listeners.

### The Solution
- **For Artists**: Upload music, purchase credits, and get guaranteed airplay in a continuous radio stream
- **For Listeners**: Discover new music through a curated, continuous stream without ads or interruptions
- **For Platform**: Sustainable revenue model through credit purchases and future subscription plans

### Key Features
- 🎵 **Continuous Radio Stream**: Seamless, uninterrupted music playback with persistent queue
- 🎤 **Artist Uploads**: Easy song upload with artwork and metadata (direct-to-storage signed URLs)
- 💳 **Credit System**: Pay-per-play model for artists with Stripe Payment Sheet (mobile) and Checkout Sessions (web)
- 🔐 **Secure Authentication**: Firebase Auth with email, Google, and Apple sign-in
- 💰 **Payment Processing**: Full Stripe integration with dual payment flows
- ❤️ **Like/Unlike Songs**: Engage with your favorite tracks
- 📊 **Admin Dashboard**: Full management interface with Firebase authentication
- 📱 **Cross-Platform**: Mobile apps (iOS/Android), Web app, and Admin dashboard
- 🔍 **Observability**: Structured logging, request tracing, and Sentry error reporting

## Architecture

### Technology Stack

- **Frontend (Mobile)**: Flutter app for iOS and Android
  - Cross-platform mobile development
  - Real-time audio streaming with `just_audio`
  - State management with Provider
  - Firebase Authentication integration
  - Stripe Payment Sheet for payments
  
- **Frontend (Web)**: Next.js 14+ web application
  - App Router with SSR/ISR for SEO-optimized marketing pages
  - Client-side dashboards for listeners, artists, and admins
  - HTTP-only session cookies for secure SSR
  - Hls.js for streaming audio playback
  - Stripe Checkout for web payments
  
- **Backend**: NestJS API server
  - RESTful API architecture with `/api/v1` versioning
  - Firebase Admin SDK for token verification
  - Supabase client for database operations
  - Stripe integration with dual payment flows (PaymentIntent + Checkout Sessions)
  - Signed upload URLs for direct-to-storage uploads
  - Structured logging with Winston
  - Request ID tracing and Sentry error reporting
  
- **Database**: Supabase (PostgreSQL)
  - User profiles and authentication data
  - Song metadata and play history
  - Credit transactions and subscriptions
  - Rotation queue management
  
- **Storage**: Supabase Storage
  - Audio file storage (`songs` bucket)
  - Album artwork storage (`artwork` bucket)
  - Direct client uploads via signed URLs
  
- **Authentication**: Firebase Authentication
  - Email/password authentication
  - Google Sign-In
  - Apple Sign-In
  - Token-based API security
  - Server-side session cookies for web SSR
  
- **Payments**: Stripe
  - PaymentIntent flow for mobile (native UI)
  - Checkout Sessions flow for web (hosted UI)
  - Webhook handling for payment events
  - Future subscription support
  
- **Admin Dashboard**: Next.js (legacy)
  - Web-based management interface with Firebase authentication
  - Being migrated to unified web app

- **Observability**
  - Winston structured logging (JSON in production)
  - Request ID middleware for distributed tracing
  - Sentry integration for error reporting

## Project Structure

### Root Directory

```
RadioApp/
├── mobile/              # Flutter mobile application
├── backend/             # NestJS backend API
├── web/                 # Next.js web application (NEW)
├── admin/               # Next.js admin dashboard (legacy)
├── docs/                # Project documentation
├── README.md            # This file
└── SETUP.md             # Quick setup guide
```

### Mobile App Structure (`mobile/`)

```
mobile/
├── lib/
│   ├── core/
│   │   ├── auth/
│   │   │   └── auth_service.dart      # Firebase auth service
│   │   ├── models/
│   │   │   ├── user.dart               # User data model
│   │   │   └── song.dart               # Song data model
│   │   └── services/
│   │       ├── api_service.dart        # HTTP API client
│   │       └── radio_service.dart      # Radio streaming + like functionality
│   ├── features/
│   │   ├── player/
│   │   │   └── player_screen.dart      # Radio player with like button
│   │   ├── upload/
│   │   │   └── upload_screen.dart      # Song upload interface
│   │   ├── profile/
│   │   │   └── profile_screen.dart     # User profile management
│   │   ├── credits/
│   │   │   └── credits_screen.dart     # Credit balance & transaction history
│   │   └── payment/
│   │       └── payment_screen.dart     # Stripe Payment Sheet integration
│   ├── widgets/
│   │   ├── login_screen.dart           # Authentication UI
│   │   └── home_screen.dart            # Bottom navigation controller
│   ├── firebase_options.dart           # Firebase configuration
│   └── main.dart                       # App entry point with Stripe init
├── android/                             # Android platform files
├── ios/                                 # iOS platform files
├── pubspec.yaml                         # Flutter dependencies
└── FIREBASE_SETUP.md                    # Firebase setup guide
```

### Web App Structure (`web/`)

```
web/
├── src/
│   ├── app/
│   │   ├── (marketing)/                # Public marketing pages (SSR/ISR)
│   │   │   ├── page.tsx                # Homepage with featured artists
│   │   │   ├── about/page.tsx          # About page
│   │   │   ├── pricing/page.tsx        # Pricing information
│   │   │   ├── faq/page.tsx            # FAQ page
│   │   │   ├── contact/page.tsx        # Contact form
│   │   │   └── layout.tsx              # Marketing layout with header/footer
│   │   ├── (auth)/                     # Authentication pages
│   │   │   ├── login/page.tsx          # Login (email/Google)
│   │   │   ├── signup/page.tsx         # Registration with role selection
│   │   │   └── layout.tsx              # Auth layout
│   │   ├── (dashboard)/                # Authenticated app pages
│   │   │   ├── dashboard/page.tsx      # Role-aware dashboard
│   │   │   ├── listen/page.tsx         # Radio player
│   │   │   ├── profile/page.tsx        # User profile management
│   │   │   ├── artist/
│   │   │   │   ├── upload/page.tsx     # Song upload (signed URLs)
│   │   │   │   ├── credits/page.tsx    # Credits & Stripe Checkout
│   │   │   │   └── stats/page.tsx      # Artist analytics
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx            # Admin dashboard
│   │   │   │   ├── songs/page.tsx      # Song moderation
│   │   │   │   └── users/page.tsx      # User management
│   │   │   └── layout.tsx              # Dashboard layout with sidebar
│   │   ├── api/auth/
│   │   │   ├── login/route.ts          # Session cookie creation
│   │   │   └── logout/route.ts         # Session cookie destruction
│   │   └── layout.tsx                  # Root layout with AuthProvider
│   ├── components/
│   │   └── radio/
│   │       ├── RadioPlayer.tsx         # Web radio player component
│   │       └── useRadioState.ts        # Audio state hook (Hls.js)
│   ├── contexts/
│   │   └── AuthContext.tsx             # Firebase auth state management
│   ├── lib/
│   │   ├── api.ts                      # Axios client with token interceptor
│   │   ├── firebase-client.ts          # Firebase client SDK
│   │   └── firebase-admin.ts           # Firebase Admin SDK (for API routes)
│   └── middleware.ts                   # Route protection middleware
├── .env.local.example                   # Environment template
├── package.json                         # Next.js dependencies
└── tsconfig.json                        # TypeScript with shared types path
```

**Key Features:**
- **Marketing Pages**: SSR/ISR for SEO with dynamic featured artists
- **Session Cookies**: HTTP-only cookies for SSR authentication
- **Token Interceptor**: Automatic ID token refresh for API calls
- **Hls.js Player**: Web-optimized audio streaming
- **Signed Uploads**: Direct-to-Supabase file uploads
- **Stripe Checkout**: Web-optimized payment flow

### Backend Structure (`backend/`)

```
backend/
├── src/
│   ├── auth/
│   │   ├── decorators/
│   │   │   ├── user.decorator.ts       # @User() decorator for controllers
│   │   │   └── roles.decorator.ts      # @Roles() decorator for RBAC
│   │   ├── guards/
│   │   │   ├── firebase-auth.guard.ts  # Firebase token verification
│   │   │   └── roles.guard.ts          # Role-based access control
│   │   ├── auth.controller.ts          # Auth endpoints
│   │   └── auth.module.ts              # Auth module definition
│   ├── common/                          # NEW: Observability infrastructure
│   │   ├── logger/
│   │   │   ├── logger.service.ts       # Winston structured logging
│   │   │   └── logger.module.ts        # Global logger module
│   │   ├── middleware/
│   │   │   └── request-id.middleware.ts # Request ID generation & tracing
│   │   ├── sentry/
│   │   │   ├── sentry.service.ts       # Sentry error reporting
│   │   │   └── sentry.module.ts        # Global Sentry module
│   │   └── filters/
│   │       └── all-exceptions.filter.ts # Global exception handler
│   ├── config/
│   │   ├── config.module.ts            # Environment configuration
│   │   ├── firebase.config.ts          # Firebase Admin SDK setup
│   │   └── supabase.config.ts          # Supabase client setup
│   ├── users/
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts      # User creation DTO
│   │   │   └── update-user.dto.ts      # User update DTO
│   │   ├── users.controller.ts         # User CRUD endpoints
│   │   ├── users.service.ts            # User business logic
│   │   └── users.module.ts             # Users module definition
│   ├── songs/
│   │   ├── dto/
│   │   │   ├── create-song.dto.ts      # Song creation DTO
│   │   │   └── get-upload-url.dto.ts   # NEW: Signed upload URL DTO
│   │   ├── songs.controller.ts         # Song endpoints (upload, upload-url, list)
│   │   ├── songs.service.ts            # Song business logic
│   │   └── songs.module.ts             # Songs module definition
│   ├── radio/
│   │   ├── radio.controller.ts         # Radio stream endpoints
│   │   ├── radio.service.ts            # Queue management & rotation logic
│   │   └── radio.module.ts             # Radio module definition
│   ├── uploads/
│   │   ├── uploads.service.ts          # File upload + signed URL generation
│   │   └── uploads.module.ts           # Uploads module definition
│   ├── payments/
│   │   ├── dto/
│   │   │   ├── create-payment-intent.dto.ts    # Mobile payment DTO
│   │   │   └── create-checkout-session.dto.ts  # NEW: Web payment DTO
│   │   ├── payments.controller.ts      # Payment endpoints & webhooks
│   │   ├── payments.service.ts         # Payment business logic (dual flows)
│   │   ├── stripe.service.ts           # Stripe API integration
│   │   └── payments.module.ts          # Payments module definition
│   ├── credits/
│   │   ├── credits.controller.ts       # Credit balance & transactions
│   │   └── credits.module.ts           # Credits module definition
│   ├── admin/
│   │   ├── dto/
│   │   │   └── update-song-status.dto.ts  # Song approval DTO
│   │   ├── admin.controller.ts         # Admin endpoints (songs, users, analytics)
│   │   ├── admin.service.ts            # Admin business logic
│   │   └── admin.module.ts             # Admin module definition
│   ├── app.module.ts                    # Root module (imports all modules)
│   ├── app.controller.ts                # Health check endpoint
│   ├── app.service.ts                   # App-level services
│   └── main.ts                          # Application entry point
├── .env.example                         # Environment template
├── package.json                          # Node.js dependencies
├── tsconfig.json                         # TypeScript configuration
└── SETUP_BACKEND.md                      # Backend setup guide
```

**Key Components:**
- **Firebase Auth Guard**: Validates Firebase ID tokens on protected routes
- **Radio Service**: Database-persistent queue with priority scoring, skip tracking
- **Uploads Service**: Multipart uploads + signed URL generation for direct uploads
- **Stripe Service**: PaymentIntents (mobile) + Checkout Sessions (web)
- **Songs Service**: Song metadata, like/unlike, play counts, rotation eligibility
- **Admin Service**: Analytics aggregation, song moderation, user role management
- **Logger Service**: Winston-based structured logging with request IDs
- **Sentry Service**: Error capture and reporting
- **AllExceptionsFilter**: Consistent error responses with tracing

### Admin Dashboard Structure (`admin/`) - Legacy

```
admin/
├── app/
│   ├── components/
│   │   ├── AuthGuard.tsx                # Route protection component
│   │   ├── DashboardLayout.tsx          # Conditional sidebar layout
│   │   ├── Sidebar.tsx                  # Navigation with sign out
│   │   └── StatsCard.tsx                # Analytics stat display
│   ├── contexts/
│   │   └── AuthContext.tsx              # Firebase auth state management
│   ├── lib/
│   │   ├── api.ts                       # Backend API client
│   │   └── firebase.ts                  # Firebase initialization
│   ├── login/
│   │   └── page.tsx                     # Login page (email/Google)
│   ├── songs/
│   │   └── page.tsx                     # Song moderation table
│   ├── users/
│   │   └── page.tsx                     # User management table
│   ├── layout.tsx                       # Root layout with providers
│   ├── page.tsx                         # Dashboard with analytics
│   └── globals.css                      # Global styles
├── public/                               # Static assets
├── .env.local.example                    # Environment template
├── package.json                          # Next.js dependencies
├── next.config.ts                        # Next.js configuration
└── tsconfig.json                         # TypeScript configuration
```

> **Note**: Admin functionality is being migrated to the unified `web/` app.

### Documentation (`docs/`)

```
docs/
├── api-spec.md                           # Complete API endpoint documentation
└── database-schema.md                    # Database schema and migrations
```

### Additional Documentation Files

- `SETUP.md`: Quick start guide
- `FIREBASE_COMPLETE_SETUP.md`: Comprehensive Firebase setup
- `FIREBASE_QUICK_START.md`: Quick Firebase reference
- `ANDROID_SDK_SETUP.md`: Android development setup
- `WINDOWS_DEVELOPER_MODE.md`: Windows-specific setup
- `QUICK_ANDROID_SDK_FIX.md`: Android SDK troubleshooting

## Setup Instructions

### Prerequisites

- Node.js 22+ and npm
- Flutter SDK 3.38+
- Firebase project
- Supabase project
- Stripe account

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Create `.env` file (copy from `.env.example`):
```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Server Configuration
PORT=3000
NODE_ENV=development
WEB_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Error Tracking (Optional)
SENTRY_DSN=https://your-key@sentry.io/your-project
```

4. Run database migrations (execute SQL from `docs/database-schema.md` in Supabase SQL editor)

5. Create storage buckets in Supabase:
   - `songs` - for audio files
   - `artwork` - for album artwork

6. Start the server:
```bash
npm run start:dev
```

### Web App Setup

1. Navigate to web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file (copy from `.env.local.example`):
```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Firebase Configuration (Client SDK)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin SDK (for API routes)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# Web URL
NEXT_PUBLIC_WEB_URL=http://localhost:3001
```

4. Start the development server:
```bash
npm run dev
```

5. Access the web app at `http://localhost:3001`

### Mobile App Setup

1. Navigate to mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
flutter pub get
```

3. Add Firebase configuration:
   - Add `google-services.json` (Android) to `android/app/`
   - Add `GoogleService-Info.plist` (iOS) to `ios/Runner/`

4. Create `.env` file:
```bash
FIREBASE_API_KEY=your-api-key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
API_BASE_URL=http://localhost:3000
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

5. Run the app:
```bash
flutter run
```

### Admin Dashboard Setup (Legacy)

1. Navigate to admin directory:
```bash
cd admin
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file (copy from `.env.local.example`)

4. Start the development server:
```bash
npm run dev
```

5. Access the dashboard at `http://localhost:3002` (or configure different port)

## How It Works

### User Flow

1. **Artist Registration & Upload**
   - Artist signs up via Firebase Authentication (email, Google, or Apple)
   - Backend creates user profile in Supabase
   - Artist uploads song file and artwork
   - **Web**: Uses signed URLs for direct-to-Supabase uploads
   - **Mobile**: Uses multipart upload through backend
   - Song metadata is saved to PostgreSQL database

2. **Credit Purchase**
   - Artist navigates to payment screen
   - **Mobile**: Stripe Payment Sheet (native UI)
   - **Web**: Stripe Checkout Session (hosted UI)
   - Stripe webhook confirms payment completion
   - Credits are added to artist's account

3. **Radio Playback**
   - Song is added to rotation queue when credits are available
   - Queue is stored in database (persists across server restarts)
   - Priority scoring based on likes, skips, and engagement
   - **Mobile**: Audio stream via `just_audio`
   - **Web**: Audio stream via Hls.js
   - Play history recorded; like/unlike updates engagement metrics

4. **Listener Experience**
   - Listener opens app/website and authenticates
   - Continuous stream plays songs from rotation queue
   - Songs play automatically in sequence
   - Listener can skip songs (limited skips per hour)
   - Like/unlike songs to influence future rotation

5. **Admin Workflow**
   - Admin signs into dashboard with Firebase
   - Backend verifies admin role from database
   - View platform analytics (total users, songs, plays, likes)
   - Review and approve/reject pending song submissions
   - Manage user roles (promote to artist/admin)

### Data Flow

```
Mobile App (Flutter) / Web App (Next.js)
    ↓ (HTTP + Firebase Token)
Backend API (NestJS)
    ↓ (Supabase Client)
PostgreSQL Database (Supabase)
    ↓ (Storage API)
Supabase Storage (Audio Files)
```

### Authentication Flow

**Mobile:**
```
1. User authenticates → Firebase Auth
2. Receives Firebase ID Token
3. Token sent with API requests → Backend
4. Backend verifies token → Firebase Admin SDK
5. User info extracted → Supabase user lookup
6. Protected routes accessible
```

**Web (Session Cookies for SSR):**
```
1. User authenticates → Firebase Auth (client)
2. ID token sent to /api/auth/login
3. Server verifies token → Creates HTTP-only session cookie
4. Cookie used for SSR personalization
5. Fresh ID token fetched for API calls (interceptor)
6. Protected routes accessible
```

### Payment Flow

**Mobile (PaymentIntent):**
```
1. Artist selects credit package → Credits Screen
2. Payment intent created → POST /payments/create-intent
3. Stripe Payment Sheet presented → flutter_stripe
4. User completes payment → Stripe processes
5. Webhook received → payment_intent.succeeded
6. Credits added → Supabase database
```

**Web (Checkout Session):**
```
1. Artist selects credit package → Credits Page
2. Checkout session created → POST /payments/create-checkout-session
3. User redirected to Stripe Checkout
4. User completes payment → Stripe processes
5. Webhook received → checkout.session.completed
6. Credits added → Supabase database
7. User redirected back with success
```

## Features Implemented

### Authentication & User Management
- ✅ Firebase Authentication (Email/Password, Google, Apple Sign-In)
- ✅ User profile creation and management
- ✅ Role-based access control (Artist, Listener, Admin)
- ✅ Secure token-based API authentication
- ✅ HTTP-only session cookies for web SSR
- ✅ Token refresh interceptor for API calls

### Music Management
- ✅ Song upload with metadata (title, artist, genre, duration)
- ✅ Album artwork upload and display
- ✅ **Signed upload URLs** for direct-to-storage uploads (web)
- ✅ Song listing and search
- ✅ Play history tracking
- ✅ Like/unlike songs functionality
- ✅ Song approval workflow (admin moderation)

### Radio Streaming
- ✅ Continuous radio stream playback
- ✅ **Persistent queue stored in database** (survives server restarts)
- ✅ Priority scoring based on engagement metrics
- ✅ Skip tracking and limits
- ✅ Queue preview endpoint
- ✅ Audio streaming via Supabase Storage URLs
- ✅ **Hls.js web player** with custom React hook

### Payment System
- ✅ Stripe payment integration
- ✅ **Dual payment flows**: PaymentIntent (mobile) + Checkout Sessions (web)
- ✅ Credit purchase system with package selection
- ✅ Webhook handling for both payment types
- ✅ Transaction history with status badges

### Mobile App Features
- ✅ **Bottom navigation bar** (Player, Upload, Credits, Profile)
- ✅ **Like button** on player screen
- ✅ **Credits screen** with balance and transaction history
- ✅ Stripe Payment Sheet integration
- ✅ Role-based navigation

### Web App Features
- ✅ **Marketing pages** (Homepage, About, Pricing, FAQ, Contact)
- ✅ **SSR/ISR** for SEO optimization
- ✅ **Session cookie authentication** for SSR
- ✅ **Role-aware dashboard** with sidebar navigation
- ✅ **Web radio player** with Hls.js
- ✅ **Artist upload page** with signed URLs
- ✅ **Credits page** with Stripe Checkout
- ✅ **Artist analytics** (plays, credits, engagement)
- ✅ **Admin dashboard** (analytics, song moderation, user management)

### Observability & Infrastructure
- ✅ RESTful API architecture with `/api/v1` versioning
- ✅ **Structured logging** with Winston (JSON in production)
- ✅ **Request ID middleware** for distributed tracing
- ✅ **Sentry integration** for error reporting
- ✅ **Global exception filter** with consistent error responses
- ✅ File upload handling (multipart/form-data + signed URLs)
- ✅ CORS configuration
- ✅ Environment-based configuration
- ✅ Global ValidationPipe for DTO validation

## Development Workflow

### Running the Full Stack

1. **Start Backend** (Terminal 1):
   ```bash
   cd backend
   npm run start:dev
   ```
   Backend runs on `http://localhost:3000`

2. **Start Web App** (Terminal 2):
   ```bash
   cd web
   npm run dev
   ```
   Web app runs on `http://localhost:3001`

3. **Start Mobile App** (Terminal 3):
   ```bash
   cd mobile
   flutter run
   ```
   App runs on connected device/emulator

### Testing

- **Backend**: Unit tests with Jest (`npm test` in `backend/`)
- **Mobile**: Widget tests (`flutter test` in `mobile/`)
- **Web**: Next.js tests (`npm test` in `web/`)
- **API**: Use Postman or similar tool with Firebase token for authenticated endpoints

### Environment Variables

Each component requires specific environment variables:

- **Backend**: See `backend/.env.example`
- **Web**: See `web/.env.local.example`
- **Mobile**: See `mobile/.env` (create from template)
- **Admin**: See `admin/.env.local.example`

### Common Development Tasks

- **Adding a new API endpoint**: Create controller, service, and module in `backend/src/`
- **Adding a new web page**: Create page in `web/src/app/`
- **Adding a new mobile screen**: Create feature folder in `mobile/lib/features/`
- **Database changes**: Update `docs/database-schema.md` and run migrations in Supabase
- **Firebase changes**: Regenerate `firebase_options.dart` with FlutterFire CLI

## Troubleshooting

### Backend Issues

- **Firebase private key parsing error**: Ensure `FIREBASE_PRIVATE_KEY` has `\n` characters properly escaped
- **Supabase connection error**: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
- **Stripe webhook errors**: Ensure `STRIPE_WEBHOOK_SECRET` matches your Stripe webhook configuration

### Web App Issues

- **Session cookie not set**: Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is valid JSON in `.env.local`
- **401 errors on API calls**: Token interceptor should refresh automatically; check browser console
- **Hls.js errors**: Ensure audio files are in supported format (HLS/MP3)

### Mobile App Issues

- **Blank screen on launch**: Check Firebase initialization in `main.dart`
- **"No Firebase App '[DEFAULT]' has been created"**: Ensure Firebase is properly configured
- **Build errors**: Run `flutter clean` and `flutter pub get`

### General Issues

- **CORS errors**: Update `CORS_ORIGIN` in backend `.env` to include all frontend URLs
- **Port conflicts**: Change ports in respective `.env` files

For more detailed troubleshooting, see:
- `mobile/TROUBLESHOOTING.md`
- `backend/SETUP_BACKEND.md`
- `WINDOWS_DEVELOPER_MODE.md` (Windows-specific)

## API Documentation

See `docs/api-spec.md` for detailed API endpoint documentation, request/response formats, and authentication requirements.

### Key Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/radio/current` | GET | No | Get current playing track |
| `/api/songs/upload-url` | POST | Artist | Get signed upload URL |
| `/api/payments/create-intent` | POST | Artist | Create PaymentIntent (mobile) |
| `/api/payments/create-checkout-session` | POST | Artist | Create Checkout Session (web) |
| `/api/admin/*` | GET/PATCH | Admin | Admin endpoints |

## Database Schema

See `docs/database-schema.md` for complete database schema, table definitions, relationships, and migration SQL scripts.

## Contributing

This is a private project. For internal contributors:

1. Create a feature branch from `main`
2. Make changes and test thoroughly
3. Update documentation as needed
4. Commit with descriptive messages
5. Push and create a pull request

## License

Private project - All rights reserved
