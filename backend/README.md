# RadioApp Backend API

NestJS backend API for the RadioApp radio streaming platform.

## Overview

The backend handles:

- **Authentication**: Firebase token verification and role-based access control
- **User Management**: Profile creation, updates, and role management
- **Song Management**: Upload, metadata, likes, and approval workflow
- **Radio System**: Track rotation queue with persistent state
- **Payments**: Stripe integration with dual flows (PaymentIntent + Checkout Sessions)
- **Credits**: Artist credit balance and transaction tracking
- **Admin Operations**: Song approval, analytics, user management
- **Observability**: Structured logging, request tracing, and Sentry error reporting

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Firebase Admin SDK
- **Payments**: Stripe (dual flows)
- **File Upload**: Multer + Signed URLs
- **Logging**: Winston (structured JSON)
- **Error Tracking**: Sentry

## Prerequisites

- Node.js 18+
- npm
- Supabase project with database tables created
- Firebase project with service account
- Stripe account (for payments)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Create `.env` file (copy from `.env.example`):
   ```env
   # Firebase Admin (from Firebase Console > Project Settings > Service Accounts)
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com

   # Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key

   # Stripe
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx

   # Server
   PORT=3000
   NODE_ENV=development
   WEB_URL=http://localhost:3001
   CORS_ORIGIN=http://localhost:3000,http://localhost:3001

   # Error Tracking (optional)
   SENTRY_DSN=https://your-key@sentry.io/your-project
   ```

   > **Security Note**: Never commit `.env` files or Firebase service account JSON files to git. These are already in `.gitignore`.

3. **Run the server**:
   ```bash
   # Development (watch mode)
   npm run start:dev

   # Production
   npm run start:prod
   ```

## Project Structure

```
backend/
├── src/
│   ├── admin/           # Admin endpoints
│   │   ├── admin.controller.ts
│   │   ├── admin.module.ts
│   │   └── admin.service.ts
│   ├── auth/            # Authentication
│   │   ├── guards/      # Firebase auth guard
│   │   ├── decorators/  # @CurrentUser, @Roles
│   │   └── auth.module.ts
│   ├── config/          # Configuration
│   │   ├── firebase.config.ts
│   │   └── supabase.config.ts
│   ├── credits/         # Credit management
│   ├── payments/        # Stripe integration
│   ├── radio/           # Radio queue system
│   ├── songs/           # Song management
│   ├── uploads/         # File upload handling
│   ├── users/           # User management
│   ├── app.module.ts
│   └── main.ts
├── test/                # E2E tests
├── package.json
└── tsconfig.json
```

## API Endpoints

### Authentication
All endpoints (except webhooks) require `Authorization: Bearer <firebase-id-token>`

### Users
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users` | POST | Create user profile |
| `/api/users/me` | GET | Get current user |
| `/api/users/me` | PUT | Update profile |
| `/api/users/:id` | GET | Get user by ID |

### Songs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/songs/upload` | POST | Upload song (multipart) |
| `/api/songs` | GET | List songs |
| `/api/songs/:id` | GET | Get song details |
| `/api/songs/:id/like` | POST | Toggle like |
| `/api/songs/:id/like` | GET | Check if liked |

### Radio
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/radio/current` | GET | Current playing track |
| `/api/radio/next` | GET | Get and play next track |
| `/api/radio/play` | POST | Report play event |

### Songs (Additional)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/songs/upload-url` | POST | Get signed upload URL (artists) |

### Payments
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/create-intent` | POST | Create Stripe PaymentIntent (mobile) |
| `/api/payments/create-checkout-session` | POST | Create Stripe Checkout (web) |
| `/api/payments/webhook` | POST | Stripe webhook handler |
| `/api/payments/transactions` | GET | Transaction history |

### Credits
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/credits/balance` | GET | Get credit balance |
| `/api/credits/transactions` | GET | Transaction history |

### Admin (requires admin role)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/songs` | GET | List songs |
| `/api/admin/songs/:id` | PATCH | Update song status |
| `/api/admin/analytics` | GET | Platform stats |
| `/api/admin/users` | GET | List users |
| `/api/admin/users/:id/role` | PATCH | Update user role |

## Available Scripts

- `npm run start:dev` - Development with hot reload
- `npm run start:prod` - Production mode
- `npm run build` - Build the project
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run E2E tests

## Production Considerations

### File Upload Memory Usage

**Warning:** File uploads are buffered in memory via Multer before being sent to Supabase Storage.

| File Type | Max Size | Concurrent Risk |
|-----------|----------|-----------------|
| Audio | 50MB | High |
| Artwork | 5MB | Medium |
| Profile | 2MB | Low |

**Memory calculation:** If 20 artists upload songs simultaneously, that's up to 1GB of RAM usage. On servers with limited memory (e.g., AWS t3.micro with 1GB RAM), this could cause Out-of-Memory (OOM) crashes.

**Mitigations:**
- For MVP: Limit concurrent uploads or use a queue
- For production: Implement streaming uploads directly to Supabase
- Consider reducing audio max size to 20MB for safety

### Radio Synchronization

The radio service implements global stream synchronization:
- All listeners hear the same song at the same time
- Credits are only deducted once per song broadcast (not per listener)
- Clients receive `started_at` and `server_time` for accurate playback sync

## Observability

The backend includes comprehensive observability features:

- **Structured Logging**: Winston logger outputs JSON in production, colorized console in development
- **Request Tracing**: Unique request ID (`x-request-id`) attached to all requests and logs
- **Error Reporting**: Sentry integration captures 5xx errors with full context
- **Global Exception Filter**: Consistent error response format across all endpoints

## Security

- **Never commit secrets**: `.env` files and Firebase JSON keys are git-ignored
- **Credential rotation**: If credentials are ever exposed, rotate them immediately via Firebase/Google Cloud Console
- **Token verification**: All protected endpoints verify Firebase ID tokens
- **Role-based access**: Guards enforce user roles (listener, artist, admin)

## Database Schema

See `/docs/database-schema.md` for complete table definitions.

Key tables:
- `users` - User profiles with role
- `songs` - Song metadata and stats
- `plays` - Play history
- `likes` - User likes
- `transactions` - Payment records
- `credits` - Artist balances
- `rotation_queue` - Radio state
