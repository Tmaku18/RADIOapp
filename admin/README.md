# NETWORX Admin Dashboard

Standalone admin dashboard for the NETWORX platform, built with Next.js 16 and React 19.

The full admin toolset (queue, DJ booth, users, reports, lyrics, payouts, and more) lives in the web app at `/admin` and in the mobile app's admin screens. This app covers the core moderation tasks.

## Overview

- **Dashboard**: Platform statistics and pending songs
- **Songs Management**: Approve/reject submissions, filter all songs, and see copyright-match flags
- **User Management**: View users and change roles (listener / artist / admin)
- **Analytics**: Platform-wide metrics and engagement data

## Tech Stack

- **Framework**: Next.js 16.1.2
- **UI**: React 19, Tailwind CSS 4
- **Authentication**: Firebase Auth + backend phone text-code verification
- **Data Fetching**: TanStack React Query
- **Charts**: Recharts
- **HTTP Client**: `fetch` wrapper in `app/lib/api.ts`

## Prerequisites

- Node.js 22+
- npm
- Backend API running (see `/backend`)
- Firebase project configured

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**: create `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=optional
   ```
   `NEXT_PUBLIC_API_URL` includes the `/api` prefix.

3. **Run the development server** on a port that does not collide with the backend (3000) or web (3001):
   ```bash
   npm run dev -- -p 3002
   ```

4. **Open in browser**: http://localhost:3002

## Project Structure

```
admin/
├── app/
│   ├── components/       # Reusable UI components
│   │   ├── AuthGuard.tsx
│   │   ├── DashboardLayout.tsx
│   │   ├── PhoneMfaGate.tsx
│   │   ├── Sidebar.tsx
│   │   └── StatsCard.tsx
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx
│   ├── lib/              # Utilities and services
│   │   ├── api.ts        # API client
│   │   └── firebase.ts   # Firebase config
│   ├── login/            # Login page
│   ├── songs/            # Songs management page
│   ├── users/            # Users management page
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Dashboard home
├── public/               # Static assets
├── package.json
└── tsconfig.json
```

## Admin Access

1. Sign in with a Firebase account whose Supabase `users` row has `role = 'admin'` (emails listed in the backend's `ADMIN_EMAILS` are promoted automatically).
2. The dashboard verifies the admin role via the backend `/auth/verify` endpoint.
3. If your phone is not yet verified, enter the text code sent by the backend.
4. Non-admin users are redirected to the login page.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/songs` | GET | List songs with status filter |
| `/admin/songs/:id` | PATCH | Update song status |
| `/admin/analytics` | GET | Platform statistics |
| `/admin/users` | GET | List users with role filter |
| `/admin/users/:id/role` | PATCH | Update user role |
| `/auth/verify` | GET | Verify admin access |
| `/auth/phone/send` | POST | Send sign-in text code |
| `/auth/phone/verify` | POST | Verify sign-in text code |
