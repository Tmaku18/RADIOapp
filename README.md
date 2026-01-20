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
- 🎵 **Continuous Radio Stream**: Seamless, uninterrupted music playback
- 🎤 **Artist Uploads**: Easy song upload with artwork and metadata
- 💳 **Credit System**: Pay-per-play model for artists
- 🔐 **Secure Authentication**: Firebase Auth with email, Google, and Apple sign-in
- 💰 **Payment Processing**: Stripe integration for secure transactions
- 📊 **Admin Dashboard**: Management interface for platform oversight

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
  - Web-based management interface
  - Analytics and reporting
  - Content moderation tools

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
│   │       └── radio_service.dart      # Radio streaming logic
│   ├── features/
│   │   ├── player/
│   │   │   └── player_screen.dart      # Main radio player UI
│   │   ├── upload/
│   │   │   └── upload_screen.dart      # Song upload interface
│   │   ├── profile/
│   │   │   └── profile_screen.dart     # User profile management
│   │   └── payment/
│   │       └── payment_screen.dart     # Credit purchase UI
│   ├── widgets/
│   │   └── login_screen.dart           # Authentication UI
│   ├── firebase_options.dart           # Firebase configuration
│   └── main.dart                       # App entry point
├── android/                             # Android platform files
├── ios/                                 # iOS platform files
├── pubspec.yaml                         # Flutter dependencies
└── FIREBASE_SETUP.md                    # Firebase setup guide
```

**Key Components:**
- **AuthService**: Manages Firebase authentication state and user sessions
- **ApiService**: Handles all HTTP requests to the NestJS backend
- **RadioService**: Manages audio playback, queue management, and stream state
- **PlayerScreen**: Main UI for radio playback with controls
- **UploadScreen**: File picker and upload interface for artists

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
│   │   ├── credits.controller.ts       # Credit management endpoints
│   │   └── credits.module.ts           # Credits module definition
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
- **Radio Service**: Manages FIFO queue, handles skip logic, tracks play history
- **Uploads Service**: Handles multipart file uploads to Supabase Storage
- **Stripe Service**: Creates payment intents and handles webhook events
- **Songs Service**: Manages song metadata, play counts, and rotation eligibility

### Admin Dashboard Structure (`admin/`)

```
admin/
├── app/
│   ├── layout.tsx                       # Root layout component
│   ├── page.tsx                          # Dashboard home page
│   └── globals.css                       # Global styles
├── public/                               # Static assets
├── package.json                          # Next.js dependencies
├── next.config.ts                        # Next.js configuration
└── tsconfig.json                         # TypeScript configuration
```

**Note**: Admin dashboard is a Git submodule and can be developed independently.

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

3. Create `.env.local` file:
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_API_URL=http://localhost:3000
```

4. Start the development server:
```bash
npm run dev
```

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
   - Backend manages FIFO queue with skip tracking
   - Mobile app requests next song from radio endpoint
   - Audio stream is delivered via Supabase Storage URLs
   - Play history is recorded for analytics

4. **Listener Experience**
   - Listener opens app and authenticates
   - Continuous stream plays songs from rotation queue
   - Songs play automatically in sequence
   - Listener can skip songs (limited skips per hour)

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
1. Artist initiates payment → Mobile App
2. Payment intent created → Stripe API (via Backend)
3. Payment processed → Stripe Checkout
4. Webhook received → Backend endpoint
5. Credits added → Supabase database
6. Song eligible for rotation
```

## Features Implemented (Phase 1 - MVP)

### Authentication & User Management
- ✅ Firebase Authentication (Email/Password, Google, Apple Sign-In)
- ✅ User profile creation and management
- ✅ Role-based access control (Artist, Listener, Admin)
- ✅ Secure token-based API authentication

### Music Management
- ✅ Song upload with metadata (title, artist, genre, duration)
- ✅ Album artwork upload and display
- ✅ Song listing and search
- ✅ Play history tracking

### Radio Streaming
- ✅ Continuous radio stream playback
- ✅ FIFO (First-In-First-Out) queue rotation
- ✅ Skip tracking and limits
- ✅ Real-time queue management
- ✅ Audio streaming via Supabase Storage URLs

### Payment System
- ✅ Stripe payment integration
- ✅ Credit purchase system
- ✅ Payment intent creation
- ✅ Webhook handling for payment events
- ✅ Transaction history

### Infrastructure
- ✅ RESTful API architecture
- ✅ File upload handling (multipart/form-data)
- ✅ CORS configuration
- ✅ Environment-based configuration
- ✅ Error handling and validation

## Next Steps (Phase 2+)

### Enhanced Features
- 🔄 Advanced rotation algorithm with engagement metrics (likes, play count, skip rate)
- ❤️ Like/unlike songs functionality
- 📊 Artist dashboard with analytics (plays, credits, earnings)
- 👑 Subscription plans (monthly/yearly unlimited plays)
- 🎯 Content moderation and review system
- 📈 Admin dashboard with platform analytics
- 🔔 Push notifications for new releases
- 🎨 Enhanced UI/UX with animations
- 🌐 Web player version
- 📱 Social sharing features

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

### General Issues

- **Git submodule issues**: If `admin/` shows as modified, commit changes separately in that directory
- **Port conflicts**: Change `PORT` in backend `.env` or use different ports for each service
- **CORS errors**: Update `CORS_ORIGIN` in backend `.env` to include your frontend URLs

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
