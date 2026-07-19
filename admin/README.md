# RadioApp Admin Dashboard

Admin dashboard for the RadioApp platform built with Next.js 16 and React 19.

## Overview

The admin dashboard provides platform management capabilities:

- **Dashboard**: View platform statistics and pending songs
- **Songs Management**: Approve/reject song submissions, view all songs with filtering
- **User Management**: View users, manage roles (listener/artist/admin)
- **Analytics**: Platform-wide metrics and engagement data

## Tech Stack

- **Framework**: Next.js 16.1.2
- **UI**: React 19, TailwindCSS 4
- **Authentication**: Firebase Auth
- **Data Fetching**: TanStack React Query
- **Charts**: Recharts
- **HTTP Client**: Axios

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Backend API running (see `/backend`)
- Firebase project configured

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Create `.env.local` from the example:
   ```bash
   cp .env.local.example .env.local
   ```

   Fill in the values:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**: http://localhost:3000

## Project Structure

```
admin/
├── app/
│   ├── components/       # Reusable UI components
│   │   ├── AuthGuard.tsx
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── StatsCard.tsx
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx
│   ├── lib/              # Utilities and services
│   │   ├── api.ts        # API client
│   │   └── firebase.ts   # Firebase config
│   ├── login/           # Login page
│   ├── songs/           # Songs management page
│   ├── users/           # Users management page
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Dashboard home
├── public/              # Static assets
├── package.json
└── tsconfig.json
```

## Admin Access

To access the admin dashboard:

1. Sign in with a Firebase account that has `role: 'admin'` in the Supabase `users` table
2. The dashboard verifies admin role via the backend `/auth/verify` endpoint
3. Non-admin users will be redirected to the login page

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
