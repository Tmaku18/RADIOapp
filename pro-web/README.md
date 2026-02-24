# RadioApp Web Application

Next.js 14+ web application for the RadioApp radio streaming platform.

## Overview

The web app provides:

- **Marketing Site**: SEO-optimized public pages with featured artists
- **Listener Experience**: Web-based radio player with likes and discovery
- **Artist Dashboard**: Upload music, purchase credits, view analytics
- **Admin Panel**: Content moderation, user management, platform analytics

## Features

### Marketing Pages (SSR/ISR)
- Homepage with featured artists and trending tracks
- About, Pricing, FAQ, and Contact pages
- SEO-optimized with server-side rendering

### Authentication
- Firebase Authentication (Email/Password, Google Sign-In)
- HTTP-only session cookies for SSR security
- Automatic token refresh for API calls
- Sign out with loading state (sidebar + profile page)

### Listener Features
- Web radio player with Hls.js
- Like/unlike songs
- Continuous streaming experience

### Artist Features
- Upload songs with signed URLs (direct to Supabase Storage)
- Purchase credits via Stripe Checkout
- View play statistics and analytics
- Manage profile

### Admin Features
- Platform analytics dashboard
- Song moderation (approve/reject)
- User management and role assignment

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth (client + admin SDK)
- **Audio**: Hls.js with custom React hooks
- **Payments**: Stripe Checkout Sessions
- **HTTP Client**: Axios with interceptors

## Prerequisites

- Node.js 18+
- npm
- Firebase project
- Backend API running

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Create `.env.local` (copy from `.env.local.example`):
   ```env
   # Backend API
   NEXT_PUBLIC_API_URL=http://localhost:3000/api

   # Firebase Client SDK
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

   # Firebase Admin SDK (for API routes)
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

   # Web URL
   NEXT_PUBLIC_WEB_URL=http://localhost:3001
   ```

   > **Security Note**: Never commit `.env.local` files to git. They are already in `.gitignore`.

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open** [http://localhost:3001](http://localhost:3001) in your browser.

## Project Structure

```
web/
├── src/
│   ├── app/
│   │   ├── (marketing)/      # Public pages (SSR/ISR)
│   │   │   ├── page.tsx      # Homepage
│   │   │   ├── about/
│   │   │   ├── pricing/
│   │   │   ├── faq/
│   │   │   └── contact/
│   │   ├── (auth)/           # Authentication pages
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/      # Authenticated pages
│   │   │   ├── dashboard/
│   │   │   ├── listen/
│   │   │   ├── profile/
│   │   │   ├── artist/       # Artist-only pages
│   │   │   └── admin/        # Admin-only pages
│   │   └── api/auth/         # Session cookie routes
│   ├── components/
│   │   └── radio/            # Radio player components
│   ├── contexts/
│   │   └── AuthContext.tsx   # Authentication state
│   ├── lib/
│   │   ├── api.ts            # Axios client with interceptors
│   │   ├── firebase-client.ts
│   │   └── firebase-admin.ts
│   └── proxy.ts              # Next.js 16 routing proxy
├── .env.local.example
├── package.json
└── tsconfig.json
```

## Available Scripts

- `npm run dev` - Development server (port 3001)
- `npm run build` - Production build
- `npm run start` - Production server
- `npm run lint` - Run ESLint

## Authentication Flow

1. User signs in with Firebase (client-side)
2. ID token sent to `/api/auth/login`
3. Server verifies token and creates HTTP-only session cookie
4. Session cookie enables SSR personalization
5. Fresh ID tokens fetched for backend API calls (via interceptor)

## File Upload Flow

1. Artist requests signed URL from backend (`POST /api/songs/upload-url`)
2. Backend generates signed Supabase Storage URL
3. Client uploads directly to Supabase (bypasses backend)
4. Client submits metadata to backend
5. Song record created in database

## Payment Flow (Stripe Checkout)

1. Artist selects credit package
2. Frontend creates checkout session via backend
3. User redirected to Stripe Checkout
4. Payment completed on Stripe
5. Webhook notifies backend
6. Credits added to artist account
7. User redirected back with success

## Deployment

Deploy to Vercel for optimal Next.js performance:

```bash
vercel
```

Or build for other platforms:

```bash
npm run build
npm run start
```

## Security

- Session cookies are HTTP-only (not accessible via JavaScript)
- All API calls include fresh Firebase ID tokens
- Protected routes enforced via middleware
- Never commit `.env.local` or credentials to git
