---
name: Web App Implementation
overview: Create a Next.js web application with server-side session auth, signed uploads, and full functionality for listeners, artists, and admins. Includes data-driven marketing homepage with SSR/ISR for SEO.
todos:
  - id: phase1-setup
    content: "Phase 1: Initialize Next.js project with TypeScript, Tailwind CSS, and project structure"
    status: pending
  - id: phase1-firebase-client
    content: "Phase 1: Set up Firebase client SDK with token refresh interceptor for API calls"
    status: pending
  - id: phase1-session-api
    content: "Phase 1: Create /api/auth/login endpoint with Firebase Admin SDK for HTTP-only session cookies"
    status: pending
  - id: phase1-middleware
    content: "Phase 1: Implement Next.js middleware for route protection using session cookies"
    status: pending
  - id: phase1-marketing
    content: "Phase 1: Build SSR/ISR marketing pages with precomputed homepage payload cache"
    status: pending
  - id: phase2-auth-pages
    content: "Phase 2: Build login and signup pages with role selection"
    status: pending
  - id: phase2-dashboard
    content: "Phase 2: Create role-aware dashboard layout with sidebar navigation"
    status: pending
  - id: phase2-radio-player
    content: "Phase 2: Implement web radio player with Hls.js + React state hook"
    status: pending
  - id: phase2-signed-uploads-backend
    content: "Phase 2: Add POST /api/v1/songs/upload-url endpoint to NestJS backend"
    status: pending
  - id: phase2-artist-upload
    content: "Phase 2: Build artist upload page with signed URL direct-to-Supabase uploads"
    status: pending
  - id: phase2-checkout-session-backend
    content: "Phase 2: Add POST /api/v1/payments/create-checkout-session endpoint for web payments"
    status: pending
  - id: phase2-payments
    content: "Phase 2: Implement credits page with Stripe Checkout session flow"
    status: pending
  - id: phase2-shared-types
    content: "Phase 2: Configure TSConfig path mapping for shared types (@shared/*)"
    status: pending
  - id: phase2-play-heartbeat
    content: "Phase 2: Implement signed heartbeat pattern for play counting authority"
    status: pending
  - id: phase3-admin-dashboard
    content: "Phase 3: Build admin dashboard with platform analytics"
    status: pending
  - id: phase3-admin-songs
    content: "Phase 3: Build admin song moderation page (approve/reject/feature)"
    status: pending
  - id: phase3-admin-users
    content: "Phase 3: Build admin user management page with role controls"
    status: pending
  - id: phase3-artist-analytics
    content: "Phase 3: Build artist analytics page (plays, credits, engagement)"
    status: pending
  - id: phase4-security
    content: "Phase 4: Implement rate limiting, abuse prevention, and audit logging"
    status: pending
  - id: phase4-observability
    content: "Phase 4: Add structured logging, request IDs, and error reporting (Sentry)"
    status: pending
  - id: phase4-streaming
    content: "Phase 4: Optimize streaming with CDN and HLS"
    status: pending
isProject: false
---

# Web Application Implementation Plan (v2.2)

This plan creates a Next.js web application with improved security (session cookies), scalability (signed uploads), and SEO (SSR/ISR marketing pages). The web app serves three purposes: marketing website, full listener/artist experience, and admin control panel.

## Architecture Overview

```mermaid
graph TD
    subgraph web [Next.js Web App]
        Marketing[Marketing Pages SSR/ISR]
        AuthPages[Auth Pages]
        Dashboard[Dashboard Client]
        AdminPanel[Admin Panel]
    end
    
    subgraph auth [Authentication Flow]
        FirebaseClient[Firebase Client SDK]
        TokenRefresh[Token Refresh Interceptor]
        SessionAPI["/api/auth/login"]
        SessionCookie[HTTP-only Cookie]
    end
    
    subgraph backend [NestJS Backend /api/v1]
        API[REST API]
        FirebaseAdmin[Firebase Admin SDK]
        SignedURLs[POST /songs/upload-url]
        CheckoutSession[POST /payments/create-checkout-session]
        Heartbeat[POST /radio/heartbeat]
        PaymentIntent[POST /payments/create-intent - Mobile]
    end
    
    subgraph storage [Data Layer]
        Supabase[(Supabase Postgres)]
        SupaStorage[Supabase Storage]
        HomepageCache[Homepage Payload Cache]
        CDN[CDN Distribution]
    end
    
    subgraph shared [Shared Code]
        DTOs[backend/src/shared/*]
    end
    
    AuthPages --> FirebaseClient
    FirebaseClient --> TokenRefresh
    TokenRefresh --> SessionAPI
    SessionAPI --> SessionCookie
    Dashboard --> API
    AdminPanel --> API
    API --> FirebaseAdmin
    Marketing --> HomepageCache
    web -.-> DTOs
    backend -.-> DTOs
```

## 1. Core Architecture

### Frontend (Web)

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Audio Player:** Hls.js + custom React hook (simplified stack)
- **Rendering Strategy:**
  - SSR/ISR for marketing pages and public artist/song pages (SEO)
  - Client components for interactive dashboards and uploads
- **Deployment:** Vercel

### Backend (NestJS - Versioned API)

- **Framework:** NestJS (existing)
- **API Version:** `/api/v1/...` (all endpoints versioned)
- **New Endpoints Required:**
  - `POST /api/v1/songs/upload-url` - Signed URL generation
  - `POST /api/v1/payments/create-checkout-session` - Stripe Checkout for web
  - `POST /api/v1/radio/heartbeat` - Play counting authority
- **Existing (Mobile):**
  - `POST /api/v1/payments/create-intent` - PaymentIntent for flutter_stripe

### Authentication Model (Hardened)

**The Rule (Explicit):**

- **Session Cookie** → UI rendering, SSR personalization, middleware protection
- **Fresh ID Token** → Every API call to NestJS (via interceptor)

This prevents the "Split Brain" problem where cookie is valid but token is expired.

### Database & Storage

- **Database:** Supabase Postgres
- **Storage:** Supabase Storage
  - `songs` bucket (audio files)
  - `artwork` bucket (images)
- **Homepage Cache:** Precomputed JSON payload for marketing pages
- **Access Model:** Backend-generated signed upload URLs

### Shared Code (Decision: TSConfig Path Mapping)

**Chosen Strategy:** TSConfig path mapping (Option 2)

```json
// web/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../backend/src/shared/*"]
    }
  }
}
```

**Why this choice:**

- No build pipeline changes required
- Backend is source of truth for types
- Works immediately with existing Vercel/Render setup
- Migrate to Turborepo later if needed

**Shared types location:** `backend/src/shared/`

- `user.ts` - User, Role interfaces
- `song.ts` - Song, UploadResponse interfaces
- `payment.ts` - PaymentIntent, CheckoutSession interfaces
- `radio.ts` - StreamToken, Heartbeat interfaces

## 2. Contract Layer (API Authorization)

Explicit definition of endpoint access requirements:

| Endpoint | Auth | Role | Token Type |

|----------|------|------|------------|

| `GET /api/v1/radio/current` | No | Any | None |

| `GET /api/v1/radio/stream` | Yes | Any | ID Token |

| `POST /api/v1/radio/heartbeat` | Yes | Any | ID Token + StreamToken |

| `POST /api/v1/songs/upload-url` | Yes | Artist | ID Token |

| `POST /api/v1/songs` | Yes | Artist | ID Token |

| `GET /api/v1/songs` | No | Any | None |

| `POST /api/v1/payments/create-intent` | Yes | Artist | ID Token |

| `POST /api/v1/payments/create-checkout-session` | Yes | Artist | ID Token |

| `POST /api/v1/payments/webhook` | No | N/A | Stripe Signature |

| `GET /api/v1/admin/*` | Yes | Admin | ID Token |

| `PATCH /api/v1/admin/*` | Yes | Admin | ID Token |

**Public-read endpoints:** radio/current, songs list, artist profiles, song pages

**Session cookie only:** Next.js SSR/middleware (never sent to NestJS)

## 3. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant User
    participant NextJS as Next.js Client
    participant Firebase as Firebase Auth
    participant Interceptor as Token Interceptor
    participant SessionAPI as /api/auth/login
    participant NestJS as NestJS Backend
    
    User->>NextJS: Click Login
    NextJS->>Firebase: signInWithPopup/Email
    Firebase-->>NextJS: ID Token
    NextJS->>SessionAPI: POST /api/auth/login (ID Token)
    SessionAPI->>Firebase: verifyIdToken + createSessionCookie
    SessionAPI-->>NextJS: Set HTTP-only Cookie (5 days)
    
    Note over NextJS,NestJS: Later: API Call
    NextJS->>Interceptor: Request to NestJS
    Interceptor->>Firebase: getIdToken(forceRefresh)
    Firebase-->>Interceptor: Fresh ID Token
    Interceptor->>NestJS: Request + Bearer Token
    NestJS->>Firebase: Verify Token
    NestJS-->>NextJS: Protected Data
```

### Token Refresh Interceptor (Critical)

Prevents Cookie/Token drift where UI thinks user is logged in but API rejects calls.

```typescript
// lib/api.ts
import axios from 'axios';
import { getAuth } from 'firebase/auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + '/api/v1',
});

// Interceptor: Always send fresh ID token
api.interceptors.request.use(async (config) => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (user) {
    // forceRefresh ensures token is valid even if cached one expired
    const token = await user.getIdToken(/* forceRefresh */ true);
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Response interceptor: Handle 401 gracefully
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token truly invalid - redirect to login
      window.location.href = '/login?session_expired=true';
    }
    return Promise.reject(error);
  }
);

export { api };
```

### Session Cookie Implementation

```typescript
// app/api/auth/login/route.ts
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  const { idToken } = await request.json();
  
  // Verify the ID token
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  
  // Create a session cookie (5 days)
  const expiresIn = 60 * 60 * 24 * 5 * 1000;
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
  
  // Set the cookie
  cookies().set('session', sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: expiresIn / 1000,
    path: '/',
  });
  
  return Response.json({ success: true, uid: decodedToken.uid });
}
```

### Role Enforcement

- Roles stored in Supabase (`listener`, `artist`, `admin`)
- Role guards enforced in:
  - Next.js middleware (UI access via session cookie)
  - NestJS guards (API access via ID token)

## 4. Project Structure

```
RadioApp/
├── web/                              # NEW - Main web application
│   ├── app/
│   │   ├── (marketing)/              # Public SSR/ISR pages
│   │   │   ├── page.tsx              # Homepage (uses cached payload)
│   │   │   ├── about/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   ├── faq/page.tsx
│   │   │   ├── contact/page.tsx
│   │   │   ├── artist/[slug]/page.tsx
│   │   │   └── song/[id]/page.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── listen/page.tsx       # Radio player
│   │   │   ├── profile/page.tsx
│   │   │   ├── artist/
│   │   │   │   ├── upload/page.tsx
│   │   │   │   ├── stats/page.tsx
│   │   │   │   └── credits/page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── songs/page.tsx
│   │   │   │   ├── users/page.tsx
│   │   │   │   └── analytics/page.tsx
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   └── auth/
│   │   │       ├── login/route.ts
│   │   │       └── logout/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   ├── marketing/
│   │   ├── radio/
│   │   │   ├── RadioPlayer.tsx       # Hls.js + useRadioState hook
│   │   │   └── useRadioState.ts      # Custom hook for controls
│   │   ├── auth/
│   │   └── dashboard/
│   ├── lib/
│   │   ├── api.ts                    # Axios with token interceptor
│   │   ├── firebase-client.ts
│   │   ├── firebase-admin.ts
│   │   └── hooks/
│   ├── middleware.ts
│   └── tsconfig.json                 # Includes @shared/* path mapping
├── backend/
│   └── src/
│       ├── shared/                   # Shared TypeScript types
│       │   ├── user.ts
│       │   ├── song.ts
│       │   ├── payment.ts
│       │   ├── radio.ts
│       │   └── index.ts
│       ├── songs/
│       │   └── songs.controller.ts   # POST /songs/upload-url
│       ├── payments/
│       │   └── payments.controller.ts # POST /payments/create-checkout-session
│       └── radio/
│           └── radio.controller.ts   # POST /radio/heartbeat
├── admin/                            # EXISTING - Deprecate after Phase 3
└── mobile/                           # EXISTING - No changes
```

## 5. File Upload Flow (Signed URLs)

```mermaid
sequenceDiagram
    participant Artist
    participant NextJS as Next.js
    participant NestJS as NestJS Backend
    participant Supabase as Supabase Storage
    
    Artist->>NextJS: Select file to upload
    NextJS->>NestJS: POST /api/v1/songs/upload-url
    Note right of NextJS: Body: { filename, contentType, bucket }
    NestJS->>NestJS: Verify artist role
    NestJS->>Supabase: createSignedUploadUrl()
    Supabase-->>NestJS: Signed URL (60s expiry)
    NestJS-->>NextJS: { signedUrl, path, expiresIn }
    NextJS->>Supabase: PUT file directly to signed URL
    Supabase-->>NextJS: Upload complete
    NextJS->>NestJS: POST /api/v1/songs (metadata + path)
    NestJS->>NestJS: Store song record
    NestJS-->>NextJS: Song created
```

### Why POST instead of GET

- **No accidental caching** (GET requests can be cached by CDN/browser)
- **No filename leaks in logs** (query params are logged, body is not)
- **Supports batch uploads** (array of files in body, no URL length limits)
- **Better validation** (can enforce contentType, size limits in body)

### Backend Endpoint: POST /api/v1/songs/upload-url

```typescript
// songs.controller.ts
@Post('upload-url')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('artist')
async getUploadUrl(
  @CurrentUser() user: FirebaseUser,
  @Body() dto: GetUploadUrlDto,
) {
  return this.songsService.getSignedUploadUrl(user.uid, dto);
}

// GetUploadUrlDto
export class GetUploadUrlDto {
  @IsString()
  filename: string;
  
  @IsString()
  @IsIn(['audio/mpeg', 'audio/wav', 'audio/mp3', 'image/jpeg', 'image/png'])
  contentType: string;
  
  @IsString()
  @IsIn(['songs', 'artwork'])
  bucket: 'songs' | 'artwork';
}

// songs.service.ts
async getSignedUploadUrl(userId: string, dto: GetUploadUrlDto) {
  const path = `${userId}/${Date.now()}-${dto.filename}`;
  
  const { data, error } = await supabase.storage
    .from(dto.bucket)
    .createSignedUploadUrl(path, 60);
    
  if (error) throw new BadRequestException(error.message);
  
  return { 
    signedUrl: data.signedUrl, 
    path: data.path,
    expiresIn: 60,
  };
}
```

## 6. Play Counting: Signed Heartbeat Pattern

**The Problem:** Client-reported plays can be scripted/abused.

**The Solution:** Signed heartbeat tokens that prove continuous listening.

```mermaid
sequenceDiagram
    participant Listener
    participant NextJS as Next.js
    participant NestJS as NestJS Backend
    participant DB as Supabase
    
    Listener->>NextJS: Start listening
    NextJS->>NestJS: GET /api/v1/radio/stream
    NestJS->>NestJS: Generate signed stream_token
    NestJS-->>NextJS: { streamUrl, streamToken, songId }
    
    loop Every 30 seconds
        NextJS->>NestJS: POST /api/v1/radio/heartbeat
        Note right of NextJS: { streamToken, songId, timestamp }
        NestJS->>NestJS: Validate token signature
        NestJS->>DB: Increment heartbeat count
    end
    
    Note over NestJS,DB: 2 heartbeats = 1 valid play
```

### Heartbeat Implementation

```typescript
// radio.controller.ts
@Post('heartbeat')
@UseGuards(FirebaseAuthGuard)
async reportHeartbeat(
  @CurrentUser() user: FirebaseUser,
  @Body() dto: HeartbeatDto,
) {
  return this.radioService.processHeartbeat(user.uid, dto);
}

// radio.service.ts
async processHeartbeat(userId: string, dto: HeartbeatDto) {
  // Verify stream token (JWT signed with server secret)
  const payload = this.verifyStreamToken(dto.streamToken);
  
  if (payload.songId !== dto.songId) {
    throw new BadRequestException('Token/song mismatch');
  }
  
  // Record heartbeat
  await supabase.from('play_heartbeats').insert({
    user_id: userId,
    song_id: dto.songId,
    stream_token: dto.streamToken,
    timestamp: new Date(),
  });
  
  // Check if this completes a play (2+ heartbeats = 60+ seconds)
  const { count } = await supabase
    .from('play_heartbeats')
    .select('*', { count: 'exact' })
    .eq('stream_token', dto.streamToken);
  
  if (count >= 2) {
    // Record valid play (only once per token)
    await this.recordPlay(dto.songId, userId, dto.streamToken);
  }
  
  return { received: true, heartbeatCount: count };
}
```

**Why this works:**

- Token ties heartbeats to a specific session
- Cannot fake 2 heartbeats without waiting 30+ seconds
- Server controls play counting authority
- Prevents scripted abuse

## 7. Audio Streaming & Playback

### Simplified Stack: Hls.js + React Hook

**Decision:** Remove howler.js. Hls.js directly on `<audio>` tag is cleaner.

**Why:**

- Howler wraps HTML5 Audio; Hls.js also wraps audio element
- Combining them adds complexity without benefit
- Custom React hook gives us all the state management we need
```typescript
// components/radio/useRadioState.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import Hls from 'hls.js';

interface RadioState {
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  currentTrack: Track | null;
}

export function useRadioState() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [state, setState] = useState<RadioState>({
    isPlaying: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    currentTrack: null,
  });

  const loadStream = useCallback((url: string, track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;

    // HLS stream
    if (url.includes('.m3u8') && Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();
      
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(audio);
      hlsRef.current = hls;
    } else {
      // Standard audio
      audio.src = url;
    }

    setState(s => ({ ...s, currentTrack: track }));
  }, []);

  const play = useCallback(() => {
    audioRef.current?.play();
    setState(s => ({ ...s, isPlaying: true }));
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState(s => ({ ...s, isPlaying: false }));
  }, []);

  const setVolume = useCallback((vol: number) => {
    if (audioRef.current) audioRef.current.volume = vol;
    setState(s => ({ ...s, volume: vol }));
  }, []);

  return { audioRef, state, loadStream, play, pause, setVolume };
}
```
```tsx
// components/radio/RadioPlayer.tsx
export function RadioPlayer() {
  const { audioRef, state, play, pause, setVolume } = useRadioState();
  
  return (
    <div className="radio-player">
      <audio ref={audioRef} />
      
      {state.currentTrack && (
        <div className="track-info">
          <img src={state.currentTrack.artworkUrl} alt="" />
          <div>
            <h3>{state.currentTrack.title}</h3>
            <p>{state.currentTrack.artistName}</p>
          </div>
        </div>
      )}
      
      <div className="controls">
        <button onClick={state.isPlaying ? pause : play}>
          {state.isPlaying ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={state.volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
```


## 8. Payments: Dual-Flow Architecture

### Mobile vs Web Flows

| Platform | Endpoint | Stripe Product | UX |

|----------|----------|----------------|-----|

| Mobile | `POST /payments/create-intent` | PaymentIntent | Native flutter_stripe UI |

| Web | `POST /payments/create-checkout-session` | Checkout Session | Redirect to stripe.com |

### Backend: POST /api/v1/payments/create-checkout-session

```typescript
async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
  // Create pending transaction
  const { data: transaction } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      amount: dto.amount,
      credits_purchased: dto.credits,
      status: 'pending',
      payment_method: 'checkout_session',
    })
    .select()
    .single();

  // Create Stripe Checkout Session
  const session = await this.stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${dto.credits} Radio Credits`,
        },
        unit_amount: dto.amount,
      },
      quantity: 1,
    }],
    metadata: {
      transaction_id: transaction.id,
      user_id: userId,
      credits: dto.credits.toString(),
    },
    success_url: `${process.env.WEB_URL}/artist/credits?success=true`,
    cancel_url: `${process.env.WEB_URL}/artist/credits?canceled=true`,
  });

  return { sessionId: session.id, url: session.url };
}
```

## 9. Marketing Homepage Cache

**Problem:** Data-driven homepage with DB queries can cause slow TTFB or ISR thrashing.

**Solution:** Precomputed homepage payload regenerated on admin action.

### Implementation

```typescript
// Supabase table: homepage_cache
// Columns: id, payload (JSONB), updated_at

// Admin action: "Publish Homepage"
async publishHomepage() {
  const payload = {
    featuredArtists: await this.getFeaturedArtists(),
    trendingTracks: await this.getTrendingTracks(),
    stats: await this.getPlatformStats(),
    updatedAt: new Date().toISOString(),
  };
  
  await supabase
    .from('homepage_cache')
    .upsert({ id: 'main', payload, updated_at: new Date() });
}

// Next.js homepage (ISR)
export const revalidate = 60; // Revalidate every 60 seconds

async function getHomepageData() {
  const { data } = await supabase
    .from('homepage_cache')
    .select('payload')
    .eq('id', 'main')
    .single();
  
  return data?.payload;
}
```

## 10. Failure Modes

Documented system behavior during failures:

| Failure | Behavior | Recovery |

|---------|----------|----------|

| **Stripe webhook delayed** | Transaction stays `pending` | Webhook eventually fires; idempotent handling |

| **Upload succeeds, metadata write fails** | Orphaned file in storage | Cron job cleans orphans after 24h |

| **Session cookie valid, token expired** | Token interceptor refreshes | If refresh fails, redirect to login |

| **Stream server down** | Player shows error state | Polling retries every 10s |

| **Supabase DB unavailable** | API returns 503 | Circuit breaker; cached data where possible |

| **Payment succeeds, credit update fails** | Transaction logged as `payment_received` | Admin alert; manual reconciliation |

## 11. Observability & Logging

### Structured Logging (NestJS)

```typescript
// main.ts
import { Logger } from '@nestjs/common';

app.useLogger(new Logger({
  json: true, // Structured logs for cloud providers
}));

// In services
this.logger.log({
  event: 'payment_completed',
  userId: user.uid,
  amount: dto.amount,
  transactionId: transaction.id,
});
```

### Request IDs

```typescript
// middleware/request-id.middleware.ts
export function requestIdMiddleware(req, res, next) {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
}
```

### Error Reporting

```typescript
// Sentry integration
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// Global exception filter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    Sentry.captureException(exception);
    // ... handle response
  }
}
```

## 12. Deployment & CI/CD

| Component | Platform |

|-----------|----------|

| Web (Next.js) | Vercel |

| Backend (NestJS) | Render / Railway / AWS |

| Database | Supabase |

| Storage | Supabase Storage |

| Streaming | Supabase + CDN |

| Error Tracking | Sentry |

| CI/CD | GitHub Actions |

## 13. Phased Rollout

### Phase 1 - Foundation

- Next.js project setup with TypeScript and Tailwind
- Firebase client auth with **token refresh interceptor**
- Server-side session cookies (`/api/auth/login`)
- Next.js middleware for route protection
- Marketing pages with **precomputed homepage cache**
- TSConfig path mapping for shared types

### Phase 2 - Web App Parity

- Login/signup pages with role selection
- Dashboard layout with role-based navigation
- Web radio player (**Hls.js + React hook**)
- **Backend:** `POST /api/v1/songs/upload-url` endpoint
- Artist upload page (direct to Supabase via signed URL)
- **Backend:** `POST /api/v1/payments/create-checkout-session` endpoint
- Credits and payment page (Stripe Checkout redirect)
- **Backend:** `POST /api/v1/radio/heartbeat` (play counting)

### Phase 3 - Admin & Analytics

- Admin dashboard with platform metrics
- Song moderation page
- User management page
- Artist analytics page
- Homepage publish action

### Phase 4 - Scale & Optimize

- Rate limiting and abuse prevention
- **Observability:** Structured logs, request IDs, Sentry
- CDN integration for audio streaming (HLS)
- Performance optimization
- Old admin deprecation

## Dependencies

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "firebase": "^11.1.0",
    "firebase-admin": "^12.0.0",
    "@stripe/stripe-js": "^4.0.0",
    "axios": "^1.7.0",
    "hls.js": "^1.5.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "tailwindcss": "^3.4.0",
    "@types/react": "^18",
    "@types/node": "^20"
  }
}
```

## Summary: v2.2 Changes from v2.1

| Issue | v2.1 | v2.2 |

|-------|------|------|

| Token/Cookie drift | Mentioned | **Token refresh interceptor with forceRefresh** |

| Upload endpoint | GET | **POST (no caching, no log leaks, batch-ready)** |

| Play counting | Duration-based | **Signed heartbeat pattern (abuse-proof)** |

| Shared types | 3 options listed | **Locked: TSConfig path mapping** |

| Audio player | howler.js + Hls.js | **Simplified: Hls.js + React hook only** |

| API versioning | Not mentioned | **All endpoints at /api/v1/** |

| Marketing cache | Not mentioned | **Precomputed homepage payload** |

| Failure modes | Not documented | **Explicit failure/recovery table** |

| Observability | Not mentioned | **Structured logs, request IDs, Sentry** |

| Contract layer | Implicit | **Explicit endpoint auth requirements** |