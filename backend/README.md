# RadioApp Backend API

NestJS backend API for the RadioApp radio streaming platform.

## Overview

The backend handles:

- **Authentication**: Firebase token verification and role-based access control
- **User Management**: Profile creation, updates, and role management
- **Song Management**: Upload, metadata, likes, and approval workflow
- **Radio System**: Track rotation queue with persistent state
- **Payments**: Stripe integration for credit purchases
- **Credits**: Artist credit balance and transaction tracking
- **Admin Operations**: Song approval, analytics, user management

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Firebase Admin SDK
- **Payments**: Stripe
- **File Upload**: Multer

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
   Create `.env` file:
   ```env
   # Firebase Admin
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
   ```

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

### Payments
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/create-intent` | POST | Create Stripe payment |
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
