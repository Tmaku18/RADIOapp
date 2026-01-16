# Radio Streaming Platform

A full-stack radio streaming platform that allows underground artists to upload music and pay for airplay while listeners tune in to a continuous curated stream.

## Architecture

- **Frontend (Mobile)**: Flutter app for iOS and Android
- **Backend**: NestJS API server
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage for audio files and images
- **Authentication**: Firebase Authentication
- **Payments**: Stripe
- **Admin Dashboard**: Next.js

## Project Structure

```
RadioApp/
├── mobile/          # Flutter mobile app
├── backend/         # NestJS backend API
├── admin/           # Next.js admin dashboard
└── docs/            # Documentation
```

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

## Features Implemented (Phase 1 - MVP)

- ✅ User authentication (Email/Password, Google, Apple)
- ✅ User profile management
- ✅ Song upload with artwork
- ✅ Basic radio streaming (FIFO queue)
- ✅ Payment integration (Stripe)
- ✅ Credit system

## Next Steps (Phase 2+)

- Advanced rotation algorithm with engagement metrics
- Like/unlike songs
- Subscription plans
- Artist dashboard
- Admin dashboard with analytics
- Content moderation

## API Documentation

See `docs/api-spec.md` for detailed API documentation.

## Database Schema

See `docs/database-schema.md` for complete database schema.

## License

Private project
