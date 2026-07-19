# NETWORX UML Diagrams (Current State)

This document captures the current product flows for web, mobile, backend, and shared services.

## Actors

| Actor | Description |
| --- | --- |
| Guest | Unauthenticated visitor |
| Listener (Prospector) | Authenticated listener using radio, votes, and discovery |
| Artist | Uploads songs, manages credits, tracks analytics, can stream |
| ServiceProvider (Catalyst) | Pro-NETWORX profile owner and service provider |
| Admin | Moderates content/users and manages operational controls |
| System | Automated workers, triggers, webhooks, and push events |

## UC1 Authentication and Profile Provisioning

```mermaid
flowchart LR
  Guest((Guest)) --> Login[Sign in]
  Guest --> Signup[Sign up]
  Login --> EmailAuth[Email password]
  Login --> GoogleAuth[Google OAuth]
  Login --> AppleAuth[Apple Sign-In]
  EmailAuth --> FirebaseIdToken[Firebase ID token]
  GoogleAuth --> FirebaseIdToken
  AppleAuth --> FirebaseIdToken
  FirebaseIdToken --> SessionCookieTry[Try session cookie endpoint]
  SessionCookieTry --> ProfileFetch[Fetch users/me]
  ProfileFetch --> ExistingProfile[Use existing profile]
  ProfileFetch --> CreateProfile[Create default profile if missing]
  ExistingProfile --> AppAccess[Dashboard access]
  CreateProfile --> AppAccess
```

## UC2 Live Radio, Voting, and Temperature

```mermaid
flowchart LR
  Listener((Listener)) --> OpenPlayer[Open listen/player]
  Artist((Artist)) --> OpenPlayer
  OpenPlayer --> CurrentTrack[Get radio current]
  CurrentTrack --> HeartbeatLoop[Send heartbeat/presence]
  CurrentTrack --> VoteTrack[Vote fire or shit]
  VoteTrack --> SaveVote[Upsert leaderboard_likes with play_id]
  SaveVote --> RefreshTemp[Refresh song_temperature]
  RefreshTemp --> ShowTemp[Render temperature percent]
  CurrentTrack --> ChatFlow[Send chat and emoji reactions]
  CurrentTrack --> LibraryFlow[Save to library on fire vote path]
```

## UC3 Artist Workflow

```mermaid
flowchart LR
  Artist((Artist)) --> UploadSong[Upload song and artwork]
  Artist --> ManageSongs[Manage songs and status]
  Artist --> BuyCredits[Buy credits or song plays]
  Artist --> AllocateCredits[Allocate credits to tracks]
  Artist --> ViewAnalytics[Open analytics and ROI]
  Artist --> LiveServices[Manage live services]
  Artist --> GoLive[Start or stop livestream]
```

## UC4 Competition and Spotlight

```mermaid
flowchart LR
  Listener((Listener)) --> CompetitionPage[Open competition page]
  Artist((Artist)) --> CompetitionPage
  CompetitionPage --> Leaderboards[View leaderboard tabs]
  Leaderboards --> ByLikes[By likes]
  Leaderboards --> ByListens[By discoveries]
  Leaderboards --> ByPositiveVotes[Positive votes]
  Leaderboards --> ByRatio[Best ratio]
  Leaderboards --> BySaves[Most saves]
  Leaderboards --> TrialByFire[Trial by fire votes per minute]
  CompetitionPage --> SpotlightView[View today/week spotlight]
  CompetitionPage --> Top7Vote[Submit Top 7 vote]
```

## UC5 Discovery, Pro-NETWORX, and Messaging

```mermaid
flowchart LR
  Listener((Listener)) --> DiscoverPeople[Discover people and content]
  Listener --> OpenDirectory[Open Pro-NETWORX directory]
  ServiceProvider((ServiceProvider)) --> EditProfile[Edit Pro-NETWORX profile]
  ServiceProvider --> ManageListings[Manage services/listings]
  Listener --> OpenMessages[Open direct messages]
  ServiceProvider --> OpenMessages
  OpenMessages --> SubscriptionGate[Creator Network access check]
  SubscriptionGate --> SendMessage[Send or receive messages]
  Listener --> JobBoard[Browse and apply on job board]
  ServiceProvider --> JobBoard
```

## UC6 Admin Operations

```mermaid
flowchart LR
  Admin((Admin)) --> ModerateSongs[Approve, reject, delete songs]
  Admin --> ManageUsers[Manage roles and bans]
  Admin --> ManageFallback[Manage fallback and queue]
  Admin --> ManageStreamers[Approve streamer access]
  Admin --> ReviewFeed[Moderate social/discover feed]
  Admin --> PlatformStats[View platform analytics]
```

## AD1 Song Upload to Rotation

```mermaid
flowchart TD
  UploadStart([Artist uploads content]) --> SubmitSong[Create song metadata]
  SubmitSong --> PendingReview[Song status pending]
  PendingReview --> AdminDecision{Admin decision}
  AdminDecision -->|Approve| ApprovedSong[Song approved]
  AdminDecision -->|Reject| RejectedSong[Song rejected]
  ApprovedSong --> TrialRotation[Eligible for trial rotation]
  TrialRotation --> CreditDecision{Credits allocated}
  CreditDecision -->|Yes| PaidRotation[Eligible for paid rotation]
  CreditDecision -->|No| TrialOnly[Trial only until exhausted]
  RejectedSong --> NotifyArtist[Notify artist]
```

## AD2 Playback and Vote Processing

```mermaid
flowchart TD
  PlayerStart([Open player]) --> GetCurrentTrack[GET radio current]
  GetCurrentTrack --> PlayAudio[Start playback]
  PlayAudio --> SendHeartbeat[POST radio heartbeat]
  SendHeartbeat --> TrackChanged{Track changed}
  TrackChanged -->|No| SendHeartbeat
  TrackChanged -->|Yes| RefreshCurrent[GET radio current]
  RefreshCurrent --> PlayAudio
  PlayAudio --> VoteDecision{User votes}
  VoteDecision -->|Yes| PostVote[POST leaderboard vote with play_id]
  PostVote --> TempRefresh[Refresh temperature cache]
  TempRefresh --> RefreshCurrent
  VoteDecision -->|No| SendHeartbeat
```

## AD3 Web Login Resilient Session Flow

```mermaid
flowchart TD
  UserLogin([User signs in on web]) --> FirebaseSignIn[Firebase auth success]
  FirebaseSignIn --> GetIdToken[Get ID token]
  GetIdToken --> SessionAttempt[Call api auth login route]
  SessionAttempt --> SessionStatus{Session cookie created}
  SessionStatus -->|Yes| ContinueWithSession[Use session plus bearer token]
  SessionStatus -->|No| ContinueWithBearer[Continue with bearer token only]
  ContinueWithSession --> FetchProfile[Fetch users/me]
  ContinueWithBearer --> FetchProfile
  FetchProfile --> ProfileReady[Authenticated app state]
```

## AD4 Competition Data Load

```mermaid
flowchart TD
  OpenCompetition([Open competition screen]) --> FetchWeekInfo[Fetch current week and spotlight]
  OpenCompetition --> FetchNews[Fetch news promotions]
  OpenCompetition --> FetchBoardLikes[Leaderboard by likes]
  OpenCompetition --> FetchBoardListens[Leaderboard by listens]
  OpenCompetition --> FetchBoardPositive[Leaderboard by positive votes]
  OpenCompetition --> FetchBoardRatio[Leaderboard by ratio]
  OpenCompetition --> FetchBoardSaves[Leaderboard by saves]
  OpenCompetition --> FetchTrial[Leaderboard upvotes per minute]
  FetchWeekInfo --> RenderCompetition[Render competition screen]
  FetchNews --> RenderCompetition
  FetchBoardLikes --> RenderCompetition
  FetchBoardListens --> RenderCompetition
  FetchBoardPositive --> RenderCompetition
  FetchBoardRatio --> RenderCompetition
  FetchBoardSaves --> RenderCompetition
  FetchTrial --> RenderCompetition
```

## ARCH1 Container Overview

```mermaid
flowchart TB
  subgraph clients [Clients]
    WebClient[Web Next.js]
    MobileClient[Flutter mobile]
  end

  subgraph services [Backend services]
    ApiServer[NestJS API]
    RedisState[Redis state and counters]
    PgData[Supabase Postgres]
    Storage[Supabase Storage]
  end

  FirebaseStack[Firebase Auth and FCM]
  StripeStack[Stripe payments and webhooks]

  WebClient --> ApiServer
  MobileClient --> ApiServer
  ApiServer --> RedisState
  ApiServer --> PgData
  ApiServer --> Storage
  ApiServer --> FirebaseStack
  ApiServer --> StripeStack
```

## ER1 Core Voting Entities

```mermaid
erDiagram
  users ||--o{ leaderboard_likes : submits
  songs ||--o{ leaderboard_likes : receives
  plays ||--o{ leaderboard_likes : scopes
  songs ||--o| song_temperature : has_cache
  users ||--o{ likes : saves
  songs ||--o{ likes : saved_by

  leaderboard_likes {
    uuid id PK
    uuid user_id FK
    uuid song_id FK
    uuid play_id FK
    text reaction
    timestamptz created_at
  }

  song_temperature {
    uuid song_id PK
    int fire_votes
    int shit_votes
    int total_votes
    int temperature_percent
    timestamptz updated_at
  }
```

## SEQ1 Vote Round Trip

```mermaid
sequenceDiagram
  participant Client as Client
  participant Api as NestAPI
  participant Db as Postgres

  Client->>Api: POST leaderboard vote (song_id, play_id, reaction)
  Api->>Db: upsert leaderboard_likes
  Api->>Db: refresh song_temperature
  Db-->>Api: updated temperature stats
  Api-->>Client: vote result
  Client->>Api: GET radio current
  Api->>Db: fetch current song plus temperature
  Api-->>Client: now playing with temperature_percent
```

---

Updated: April 2026
