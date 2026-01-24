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
- 🎤 **Artist Uploads**: Easy song upload with artwork and metadata
- 💳 **Credit System**: Pay-per-play model for artists with Stripe Payment Sheet
- 🔐 **Secure Authentication**: Firebase Auth with email, Google, and Apple sign-in
- 💰 **Payment Processing**: Full Stripe integration with Payment Sheet UI
- ❤️ **Like/Unlike Songs**: Engage with your favorite tracks
- 📊 **Admin Dashboard**: Full management interface with Firebase authentication
- 📱 **Bottom Navigation**: Easy access to Player, Upload, Credits, and Profile screens

## Architecture

### Technology Stack

- **Frontend (Mobile)**: Flutter app for iOS and Android
  - Cross-platform mobile development
  - Real-time audio streaming with `just_audio`
  - State management with Provider
  - Firebase Authentication integration
  
- **Backend**: NestJS API server
  - RESTful API architecture
  - Firebase Admin SDK for token verification
  - Supabase client for database operations
  - Stripe integration for payments
  - File upload handling with Multer
  
- **Database**: Supabase (PostgreSQL)
  - User profiles and authentication data
  - Song metadata and play history
  - Credit transactions and subscriptions
  - Rotation queue management
  
- **Storage**: Supabase Storage
  - Audio file storage (`songs` bucket)
  - Album artwork storage (`artwork` bucket)
  
- **Authentication**: Firebase Authentication
  - Email/password authentication
  - Google Sign-In
  - Apple Sign-In
  - Token-based API security
  
- **Payments**: Stripe
  - Credit purchase processing
  - Webhook handling for payment events
  - Future subscription support
  
- **Admin Dashboard**: Next.js
  - Web-based management interface with Firebase authentication
  - Song moderation (approve/reject pending songs)
  - User management with role editing
  - Real-time analytics and reporting
  - Connected to live backend API

## Project Structure

### Root Directory

```
RadioApp/
├── mobile/              # Flutter mobile application
├── backend/             # NestJS backend API
├── admin/               # Next.js admin dashboard (submodule)
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

**Key Components:**
- **AuthService**: Manages Firebase authentication state and user sessions
- **ApiService**: Handles all HTTP requests to the NestJS backend
- **RadioService**: Manages audio playback, queue management, like/unlike functionality
- **HomeScreen**: Bottom navigation bar for Player, Upload, Credits, Profile
- **PlayerScreen**: Radio player with play/pause/skip and like button
- **CreditsScreen**: View balance, total purchased/used, transaction history
- **PaymentScreen**: Stripe Payment Sheet for credit purchases

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
│   │   │   └── create-song.dto.ts      # Song creation DTO
│   │   ├── songs.controller.ts         # Song endpoints (upload, list, etc.)
│   │   ├── songs.service.ts            # Song business logic
│   │   └── songs.module.ts             # Songs module definition
│   ├── radio/
│   │   ├── radio.controller.ts         # Radio stream endpoints
│   │   ├── radio.service.ts            # Queue management & rotation logic
│   │   └── radio.module.ts             # Radio module definition
│   ├── uploads/
│   │   ├── uploads.service.ts          # File upload to Supabase Storage
│   │   └── uploads.module.ts           # Uploads module definition
│   ├── payments/
│   │   ├── dto/
│   │   │   └── create-payment-intent.dto.ts
│   │   ├── payments.controller.ts      # Payment endpoints & webhooks
│   │   ├── payments.service.ts         # Payment business logic
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
├── config/
│   └── firebase-service-account.json.json  # Firebase service account (template)
├── dist/                                 # Compiled JavaScript output
├── package.json                          # Node.js dependencies
├── tsconfig.json                         # TypeScript configuration
└── SETUP_BACKEND.md                      # Backend setup guide
```

**Key Components:**
- **Firebase Auth Guard**: Validates Firebase ID tokens on protected routes
- **Radio Service**: Database-persistent queue with priority scoring, skip tracking
- **Uploads Service**: Handles multipart file uploads to Supabase Storage
- **Stripe Service**: Creates payment intents and handles webhook events
- **Songs Service**: Song metadata, like/unlike, play counts, rotation eligibility
- **Admin Service**: Analytics aggregation, song moderation, user role management
- **Credits Controller**: Balance queries and transaction history endpoints

### Admin Dashboard Structure (`admin/`)

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

**Key Features:**
- **Firebase Authentication**: Email/password and Google sign-in
- **AuthGuard**: Protects routes and verifies admin role
- **Dashboard**: Real-time analytics (users, songs, plays, likes)
- **Song Moderation**: Approve/reject pending songs
- **User Management**: View users, change roles (listener/artist/admin)
- **Live API Connection**: Fetches real data from NestJS backend

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
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
PORT=3000
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

4. Run database migrations (execute SQL from `docs/database-schema.md` in Supabase SQL editor)

5. Create storage buckets in Supabase:
   - `songs` - for audio files
   - `artwork` - for album artwork

6. Start the server:
```bash
npm run start:dev
```

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

### Admin Dashboard Setup

1. Navigate to admin directory:
```bash
cd admin
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file (copy from `.env.local.example`):
```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Firebase Configuration (Web)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

4. Start the development server:
```bash
npm run dev
```

5. Access the dashboard at `http://localhost:3001`
   - Sign in with an admin account (email/password or Google)
   - Non-admin users will see an "Access Denied" message

## How It Works

### User Flow

1. **Artist Registration & Upload**
   - Artist signs up via Firebase Authentication (email, Google, or Apple)
   - Backend creates user profile in Supabase
   - Artist uploads song file and artwork through mobile app
   - Files are stored in Supabase Storage buckets
   - Song metadata is saved to PostgreSQL database

2. **Credit Purchase**
   - Artist navigates to payment screen
   - Selects credit amount and initiates Stripe payment
   - Payment intent created via backend API
   - Stripe webhook confirms payment completion
   - Credits are added to artist's account

3. **Radio Playback**
   - Song is added to rotation queue when credits are available
   - **Queue is stored in database** (persists across server restarts)
   - **Priority scoring** based on likes, skips, and engagement
   - Mobile app requests next song from radio endpoint
   - Audio stream is delivered via Supabase Storage URLs
   - Play history recorded; **like/unlike** updates engagement metrics

4. **Listener Experience**
   - Listener opens app and authenticates
   - Continuous stream plays songs from rotation queue
   - Songs play automatically in sequence
   - Listener can skip songs (limited skips per hour)
   - Like/unlike songs to influence future rotation

5. **Admin Workflow**
   - Admin signs into dashboard with Firebase (email/Google)
   - Backend verifies admin role from database
   - View platform analytics (total users, songs, plays, likes)
   - Review and approve/reject pending song submissions
   - Manage user roles (promote to artist/admin)

### Data Flow

```
Mobile App (Flutter)
    ↓ (HTTP + Firebase Token)
Backend API (NestJS)
    ↓ (Supabase Client)
PostgreSQL Database (Supabase)
    ↓ (Storage API)
Supabase Storage (Audio Files)
```

### Authentication Flow

```
1. User authenticates → Firebase Auth
2. Receives Firebase ID Token
3. Token sent with API requests → Backend
4. Backend verifies token → Firebase Admin SDK
5. User info extracted → Supabase user lookup
6. Protected routes accessible
```

### Payment Flow

```
1. Artist selects credit package → Credits Screen
2. Payment intent created → Stripe API (via Backend)
3. Stripe Payment Sheet presented → flutter_stripe
4. User completes payment → Stripe processes
5. Webhook received → Backend endpoint
6. Credits added → Supabase database
7. Song eligible for rotation
```

### Admin Authentication Flow

```
1. Admin visits dashboard → /login page
2. Signs in via Firebase → Email/Password or Google
3. Firebase ID token obtained → AuthContext
4. Token sent to backend → /auth/verify
5. Backend checks user role in database
6. If role === 'admin' → Grant access
7. Non-admins see "Access Denied" page
```

## Features Implemented (Phase 1 & 2 - MVP Complete)

### Authentication & User Management
- ✅ Firebase Authentication (Email/Password, Google, Apple Sign-In)
- ✅ User profile creation and management
- ✅ Role-based access control (Artist, Listener, Admin)
- ✅ Secure token-based API authentication
- ✅ Admin dashboard with Firebase authentication

### Music Management
- ✅ Song upload with metadata (title, artist, genre, duration)
- ✅ Album artwork upload and display
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

### Payment System
- ✅ Stripe payment integration
- ✅ **Stripe Payment Sheet UI** (full payment flow)
- ✅ Credit purchase system with package selection
- ✅ Payment intent creation
- ✅ Webhook handling for payment events
- ✅ Transaction history with status badges

### Mobile App Features
- ✅ **Bottom navigation bar** (Player, Upload, Credits, Profile)
- ✅ **Like button** on player screen
- ✅ **Credits screen** with balance and transaction history
- ✅ Stripe Payment Sheet integration
- ✅ Role-based navigation (Artists see Upload/Credits, Listeners see Profile)

### Admin Dashboard
- ✅ Firebase authentication (email/Google sign-in)
- ✅ Route protection with admin role verification
- ✅ **Analytics dashboard** (users, songs, plays, likes)
- ✅ **Song moderation** (approve/reject pending songs)
- ✅ **User management** (view users, change roles)
- ✅ Live backend API connection

### Infrastructure
- ✅ RESTful API architecture
- ✅ File upload handling (multipart/form-data)
- ✅ CORS configuration
- ✅ Environment-based configuration
- ✅ Error handling and validation
- ✅ Global ValidationPipe for DTO validation

## Next Steps (Phase 3+)

### Enhanced Features
- 🔄 Advanced rotation algorithm with weighted scoring
- 👑 Subscription plans (monthly/yearly unlimited plays)
- 🔔 Push notifications for new releases and song approvals
- 🎨 Enhanced UI/UX with animations
- 🌐 Web player version
- 📱 Social sharing features
- 📈 Artist analytics dashboard (plays, credits, earnings)
- 🔍 Search and discovery features

## Development Workflow

### Running the Full Stack

1. **Start Backend** (Terminal 1):
   ```bash
   cd backend
   npm run start:dev
   ```
   Backend runs on `http://localhost:3000`

2. **Start Mobile App** (Terminal 2):
   ```bash
   cd mobile
   flutter run
   ```
   App runs on connected device/emulator

3. **Start Admin Dashboard** (Terminal 3, optional):
   ```bash
   cd admin
   npm run dev
   ```
   Dashboard runs on `http://localhost:3001`

### Testing

- **Backend**: Unit tests with Jest (`npm test` in `backend/`)
- **Mobile**: Widget tests (`flutter test` in `mobile/`)
- **API**: Use Postman or similar tool with Firebase token for authenticated endpoints

### Environment Variables

Each component requires specific environment variables:

- **Backend**: See `backend/.env` (use `backend/ENV_REQUIREMENTS.md` as reference)
- **Mobile**: See `mobile/.env` (create from template)
- **Admin**: See `admin/.env.local` (create from template)

### Common Development Tasks

- **Adding a new API endpoint**: Create controller, service, and module in `backend/src/`
- **Adding a new screen**: Create feature folder in `mobile/lib/features/`
- **Database changes**: Update `docs/database-schema.md` and run migrations in Supabase
- **Firebase changes**: Regenerate `firebase_options.dart` with FlutterFire CLI

## Troubleshooting

### Backend Issues

- **Firebase private key parsing error**: Ensure `FIREBASE_PRIVATE_KEY` has `\n` characters properly escaped (see `backend/FIREBASE_KEY_FORMAT.md`)
- **Supabase connection error**: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
- **Stripe webhook errors**: Ensure `STRIPE_WEBHOOK_SECRET` matches your Stripe webhook configuration

### Mobile App Issues

- **Blank screen on launch**: Check Firebase initialization in `main.dart` and verify `google-services.json` is present
- **"No Firebase App '[DEFAULT]' has been created"**: Ensure Firebase is properly configured (see `mobile/FIREBASE_SETUP.md`)
- **Build errors**: Run `flutter clean` and `flutter pub get`
- **Android SDK errors**: See `ANDROID_SDK_SETUP.md` and `QUICK_ANDROID_SDK_FIX.md`

### Admin Dashboard Issues

- **"next dev is not recognized"**: Run `npm install` in the `admin/` directory first
- **Access Denied after login**: User's role must be 'admin' in the database
- **Can't sign in**: Verify Firebase environment variables in `.env.local`
- **API errors**: Ensure backend is running on the correct port and CORS is configured

### General Issues

- **Git submodule issues**: If `admin/` shows as modified, commit changes separately in that directory
- **Port conflicts**: Change `PORT` in backend `.env` or use different ports for each service
- **CORS errors**: Update `CORS_ORIGIN` in backend `.env` to include your frontend URLs (including `http://localhost:3001` for admin)

For more detailed troubleshooting, see:
- `mobile/TROUBLESHOOTING.md`
- `backend/SETUP_BACKEND.md`
- `WINDOWS_DEVELOPER_MODE.md` (Windows-specific)

## API Documentation

See `docs/api-spec.md` for detailed API endpoint documentation, request/response formats, and authentication requirements.

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
