# Radio Streaming Platform - Phased Implementation Plan

## Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Flutter App    │────▶│  NestJS API  │────▶│  Supabase   │
│  (iOS/Android)  │     │   Backend    │     │  PostgreSQL │
└─────────────────┘     └──────────────┘     └─────────────┘
         │                      │                     │
         │                      │                     │
         ▼                      ▼                     ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│ Firebase Auth   │     │ Supabase     │     │   Stripe    │
│                 │     │ Storage      │     │  Payments   │
└─────────────────┘     └──────────────┘     └─────────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │ Next.js Admin│
                        │   Dashboard  │
                        └──────────────┘
```

## Project Structure

```
RadioApp/
├── mobile/                    # Flutter app
│   ├── lib/
│   │   ├── main.dart
│   │   ├── core/
│   │   │   ├── auth/
│   │   │   ├── services/
│   │   │   └── models/
│   │   ├── features/
│   │   │   ├── player/
│   │   │   ├── upload/
│   │   │   ├── profile/
│   │   │   └── payment/
│   │   └── widgets/
│   └── pubspec.yaml
├── backend/                   # NestJS backend
│   ├── src/
│   │   ├── main.ts
│   │   ├── auth/
│   │   ├── users/
│   │   ├── songs/
│   │   ├── radio/
│   │   ├── payments/
│   │   ├── uploads/
│   │   └── common/
│   ├── package.json
│   └── tsconfig.json
├── admin/                     # Next.js admin dashboard
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
└── docs/                      # Documentation
    ├── database-schema.md
    └── api-spec.md
```

## Database Schema (Supabase)

### Core Tables

- `users` - User profiles (artist/listener/admin roles)
- `songs` - Track metadata, file URLs, credits, engagement metrics
- `plays` - Play history and rotation tracking
- `likes` - User song likes
- `subscriptions` - Artist subscription plans
- `transactions` - Stripe payment records
- `credits` - Artist play credits balance
- `rotation_queue` - Current rotation state

## Phase 1: MVP - Core Infrastructure

### 1.1 Project Setup

- Initialize Flutter project with required dependencies (firebase_auth, http, audio_service, etc.)
- Initialize NestJS backend with TypeScript, Firebase Admin SDK, Supabase client
- Set up Supabase project with initial schema
- Configure Firebase Authentication
- Set up environment configuration files

### 1.2 Authentication Flow

**Files:**

- `mobile/lib/core/auth/auth_service.dart` - Firebase Auth wrapper
- `backend/src/auth/auth.module.ts` - NestJS auth module
- `backend/src/auth/guards/firebase-auth.guard.ts` - Token verification guard
- `backend/src/auth/decorators/user.decorator.ts` - Extract user from token

**Implementation:**

- Flutter: Email/password and social login (Google, Apple)
- Backend: Middleware to verify Firebase ID tokens
- Role-based access control (RBAC) decorators

### 1.3 User Management

**Files:**

- `mobile/lib/features/profile/profile_screen.dart`
- `backend/src/users/users.module.ts`
- `backend/src/users/users.service.ts`
- `backend/src/users/dto/create-user.dto.ts`

**Features:**

- User registration/profile creation
- Role assignment (artist/listener)
- Profile image upload to Supabase Storage

### 1.4 Song Upload System

**Files:**

- `mobile/lib/features/upload/upload_screen.dart`
- `backend/src/uploads/uploads.module.ts`
- `backend/src/uploads/uploads.service.ts`
- `backend/src/songs/songs.module.ts`
- `backend/src/songs/songs.service.ts`

**Implementation:**

- Flutter: File picker for audio (MP3/WAV) and album art
- Backend: Multipart upload handler
- Upload to Supabase Storage with CDN URLs
- Store metadata in `songs` table
- Validate file types and sizes

### 1.5 Basic Radio Streaming

**Files:**

- `mobile/lib/features/player/player_screen.dart`
- `mobile/lib/core/services/radio_service.dart`
- `backend/src/radio/radio.module.ts`
- `backend/src/radio/radio.service.ts`
- `backend/src/radio/radio.controller.ts`

**Features:**

- Simple FIFO queue rotation
- WebSocket or polling for next track
- Audio playback with just_audio or audio_service
- Basic play history logging

### 1.6 Payment Integration (Stripe)

**Files:**

- `mobile/lib/features/payment/payment_screen.dart`
- `backend/src/payments/payments.module.ts`
- `backend/src/payments/payments.service.ts`
- `backend/src/payments/stripe.service.ts`

**Implementation:**

- Stripe payment intents for credit purchases
- Webhook handler for payment confirmation
- Update `credits` table on successful payment
- Transaction logging in `transactions` table

## Phase 2: Enhanced Features

### 2.1 Advanced Radio Rotation Algorithm

**Files:**

- `backend/src/radio/rotation.service.ts`
- `backend/src/radio/rotation-algorithm.ts`

**Algorithm Logic:**

- Weight tracks by purchased credits
- Factor in engagement metrics (likes, skip rate)
- Enforce fairness rules (no repeats within X tracks)
- Priority queue based on credit balance and time since last play
- Admin override capability

### 2.2 Engagement Features

**Files:**

- `mobile/lib/features/player/like_button.dart`
- `backend/src/songs/songs.controller.ts` (like endpoint)

**Features:**

- Like/unlike songs
- Track skip events
- Display play count and like count
- Update engagement metrics in database

### 2.3 Subscription Plans

**Files:**

- `backend/src/subscriptions/subscriptions.module.ts`
- `mobile/lib/features/payment/subscription_screen.dart`

**Features:**

- Monthly/yearly subscription tiers
- Stripe subscription management
- Auto-renewal handling
- Credit allocation based on plan

### 2.4 Artist Dashboard (Mobile)

**Files:**

- `mobile/lib/features/artist/dashboard_screen.dart`
- `backend/src/analytics/analytics.service.ts`

**Features:**

- View play count per song
- Credit balance display
- Earnings/expenditure tracking
- Upload history

## Phase 3: Admin Dashboard

### 3.1 Next.js Admin Setup

**Files:**

- `admin/app/layout.tsx`
- `admin/app/page.tsx`
- `admin/lib/auth.ts` - Admin authentication
- `admin/lib/api.ts` - API client

**Features:**

- Admin login (Firebase Auth with admin role check)
- Protected routes
- API integration with NestJS backend

### 3.2 Content Management

**Files:**

- `admin/app/songs/page.tsx`
- `admin/app/users/page.tsx`
- `admin/components/SongTable.tsx`
- `admin/components/UserTable.tsx`

**Features:**

- View all songs with metadata
- Approve/reject song uploads
- User management (ban, role changes)
- Content moderation tools

### 3.3 Analytics Dashboard

**Files:**

- `admin/app/analytics/page.tsx`
- `admin/components/AnalyticsCharts.tsx`
- `backend/src/analytics/analytics.controller.ts`

**Features:**

- Total plays, active users, revenue charts
- Top artists and songs
- Engagement metrics visualization
- Export reports

### 3.4 Radio Control

**Files:**

- `admin/app/radio/page.tsx`
- `admin/components/RadioControls.tsx`

**Features:**

- View current rotation queue
- Manual track override
- Rotation algorithm tuning
- Emergency stop/start

## Phase 4: Production Optimization

### 4.1 Performance & Scalability

- Implement Redis caching for rotation queue
- Database query optimization (indexes, connection pooling)
- CDN configuration for audio streaming
- Audio transcoding pipeline (multiple bitrates)
- Background job processing (Bull/BullMQ)

### 4.2 Security Hardening

- Rate limiting on upload endpoints
- File type validation (magic number checking)
- CORS configuration
- Webhook signature verification (Stripe)
- Input sanitization and SQL injection prevention

### 4.3 Monitoring & Logging

- Error tracking (Sentry)
- Application monitoring
- Database query logging
- Payment transaction audit trail

### 4.4 Testing

- Unit tests for rotation algorithm
- Integration tests for payment flow
- E2E tests for critical user paths
- Load testing for streaming endpoints

## Key Implementation Details

### Radio Rotation Algorithm Pseudocode

```
1. Fetch songs with credits > 0
2. Calculate priority score: (credits * weight) + (engagement_score * weight) - (recent_plays_penalty)
3. Sort by priority (descending)
4. Filter out songs played in last N tracks
5. Select top track
6. Decrement credits, log play, update rotation queue
```

### Payment Flow

```
1. Artist selects credit package
2. Frontend calls backend /payments/create-intent
3. Backend creates Stripe PaymentIntent
4. Frontend confirms payment with Stripe SDK
5. Stripe webhook → Backend updates credits
6. Frontend polls or receives notification
```

### File Upload Flow

```
1. Artist selects audio file + artwork
2. Flutter uploads to backend /uploads/song (multipart)
3. Backend validates file, generates unique filename
4. Upload to Supabase Storage
5. Get CDN URL, store metadata in database
6. Return song ID to frontend
```

## Dependencies Summary

### Flutter (mobile/)

- `firebase_auth`, `firebase_core`
- `just_audio` or `audio_service`
- `http`, `dio`
- `file_picker`, `image_picker`
- `stripe_payment` or `flutter_stripe`

### NestJS (backend/)

- `@nestjs/core`, `@nestjs/common`
- `firebase-admin`
- `@supabase/supabase-js`
- `stripe`
- `@nestjs/config`
- `class-validator`, `class-transformer`
- `multer` (file uploads)

### Next.js (admin/)

- `next`, `react`, `react-dom`
- `firebase` (client SDK)
- `@tanstack/react-query`
- `recharts` or `chart.js`
- `tailwindcss`

## Environment Variables

### Backend (.env)

```
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PORT=3000
```

### Flutter (mobile/.env)

```
FIREBASE_API_KEY=
FIREBASE_PROJECT_ID=
API_BASE_URL=http://localhost:3000
STRIPE_PUBLISHABLE_KEY=
```

### Admin (admin/.env.local)

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Next Steps After Plan Approval

1. Initialize all three projects (Flutter, NestJS, Next.js)
2. Set up Supabase project and create database schema
3. Configure Firebase Authentication
4. Implement Phase 1 features in order
5. Test each phase before moving to next
6. Deploy infrastructure (Supabase, Firebase, hosting)
