# NETWORX UML Diagrams (Current State)

This document captures the current product flows for web, mobile, backend, and shared services.

## Actors

| Actor | Description |
| --- | --- |
| Guest | Unauthenticated visitor; can listen to radio, browse Discover, and view public profiles |
| Listener (Prospector) | Authenticated listener using radio, votes, ratings, and discovery |
| Artist | Uploads songs and beats, buys placements, tracks analytics, can stream and sell |
| ServiceProvider (Catalyst) | Pro-NETWORX profile owner, service provider, studio owner |
| DJ / Musician | Maker roles with artist-level access; votes count in the peer cohort |
| Admin | Moderates content/users and manages operational controls |
| System | Automated workers, triggers, webhooks, store notifications, and push events |

## UC1 Authentication and Profile Provisioning

```mermaid
flowchart LR
  Guest((Guest)) --> Login[Sign in]
  Guest --> Signup[Sign up]
  Login --> EmailAuth[Email password]
  Login --> GoogleAuth[Google OAuth]
  Login --> AppleAuth[Apple Sign-In]
  Signup --> EmailAuth
  EmailAuth --> FirebaseIdToken[Firebase ID token]
  GoogleAuth --> FirebaseIdToken
  AppleAuth --> FirebaseIdToken
  FirebaseIdToken --> ProfileFetch[Fetch users/me]
  ProfileFetch --> ExistingProfile[Use existing profile]
  ProfileFetch --> ProfileSetup[First-time profile setup: name, role, maker roles, terms]
  ProfileSetup --> CreateProfile[POST users]
  ExistingProfile --> PhoneCheck{Phone code verified for this sign-in}
  CreateProfile --> PhoneCheck
  PhoneCheck -->|No| PhoneCode[Send and verify SMS code]
  PhoneCode --> AppAccess[App access]
  PhoneCheck -->|Yes| AppAccess
  ExistingProfile --> Restore[Pending deletion within 48 hours is cancelled]
```

## UC2 Live Radio, Voting, and Temperature

```mermaid
flowchart LR
  Guest((Guest)) --> OpenPlayer[Open listen/player]
  Listener((Listener)) --> OpenPlayer
  Artist((Artist)) --> OpenPlayer
  OpenPlayer --> PickStation[Pick one of 30 stations]
  PickStation --> CurrentTrack[Get radio current]
  CurrentTrack --> PresenceLoop[Send presence or heartbeat]
  CurrentTrack --> VoteTrack[Vote fire or poop]
  VoteTrack --> StampVote[Stamp cohort and counts_toward_score]
  StampVote --> SaveVote[Upsert leaderboard_likes with play_id]
  SaveVote --> RefreshTemp[Refresh song_temperature]
  RefreshTemp --> ShowTemp[Render temperature, popular and peer]
  VoteTrack --> UndoVote[Same reaction again removes the vote]
  CurrentTrack --> RateSong[Rate song 1 to 10]
  CurrentTrack --> ChatFlow[Live Chat and emoji reactions]
  CurrentTrack --> CommentsFlow[Song Comments thread]
  CurrentTrack --> StoriesFlow[View or post song stories]
  CurrentTrack --> ReportSong[Report song, filed as a report on the artist]
  VoteTrack --> LibraryFlow[Fire vote saves to Liked]
```

## UC3 Artist Workflow

```mermaid
flowchart LR
  Artist((Artist)) --> UploadSong[Upload song or beat and artwork]
  Artist --> ManageSongs[Manage songs, albums, and status]
  Artist --> BuyPlacements[Buy discovery placements for a song]
  Artist --> WelcomePlacements[Apply welcome placements]
  Artist --> SellSongs[Set price and sell songs or beats]
  Artist --> ProRadioOptIn[Opt songs into Pro-Radio]
  Artist --> ViewAnalytics[Open analytics and ROI]
  Artist --> Payouts[Stripe Connect payouts]
  Artist --> LiveServices[Manage live services]
  Artist --> GoLive[Start or stop livestream]
  Artist --> FanList[Collect fan emails]
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
  Guest((Guest)) --> PublicDirectory[Browse public Pro-NETWORX profiles and directory]
  Listener((Listener)) --> DiscoverPeople[Discover people, feed, and map]
  Listener --> OpenDirectory[Open Pro-NETWORX directory]
  ServiceProvider((ServiceProvider)) --> EditProfile[Edit Pro-NETWORX profile and resume]
  ServiceProvider --> ManageListings[Manage services/listings]
  ServiceProvider --> ManageStudios[Publish studios with rate cards]
  Listener --> OpenMessages[Open direct messages]
  ServiceProvider --> OpenMessages
  OpenMessages --> RequestGate[Accept message request]
  RequestGate --> SubscriptionGate[Pro-Networx messaging access check]
  SubscriptionGate --> SendMessage[Send or receive messages]
  Listener --> JobBoard[Browse and apply on job board]
  ServiceProvider --> JobBoard
  Listener --> CrossDomain[Hand off sign-in between networxradio.com and pro-networx.com]
```

## UC6 Admin Operations

```mermaid
flowchart LR
  Admin((Admin)) --> ModerateSongs[Approve, reject, delete songs]
  Admin --> Copyright[Review copyright matches, demonetize]
  Admin --> ManageUsers[Manage roles and bans]
  Admin --> ManageRotation[Manage free rotation and station queues]
  Admin --> DjBooth[Run the DJ Booth: transport, mic, soundboard]
  Admin --> ManageStreamers[Approve streamer access]
  Admin --> ReviewFeed[Moderate feed, reports, and stories]
  Admin --> ActivityFlags[Review vote and comment activity flags]
  Admin --> AppReleases[Publish app releases]
  Admin --> PlatformStats[View platform analytics]
```

## UC7 Pro-Radio and Library

```mermaid
flowchart LR
  Listener((Listener)) --> Subscribe[Subscribe to Pro-Radio]
  Subscribe --> WebPay[Stripe on web]
  Subscribe --> StorePay[App Store or Google Play on mobile]
  Listener --> OnDemand[Play opted-in songs on demand]
  Listener --> Playlists[Create and edit playlists]
  Listener --> Starred[Star songs and artists]
  Listener --> Buy[Buy songs or beats]
```

## AD1 Song Upload to Rotation

```mermaid
flowchart TD
  UploadStart([Artist uploads content]) --> SubmitSong[Create song metadata]
  SubmitSong --> Transcode[Transcode lossless audio to MP3]
  Transcode --> CopyrightScan[ACRCloud copyright scan]
  CopyrightScan --> PendingReview[Song status pending]
  PendingReview --> AdminDecision{Admin decision}
  AdminDecision -->|Approve| ApprovedSong[Approved: public and in free rotation]
  AdminDecision -->|Reject with reason| RejectedSong[Song rejected]
  ApprovedSong --> QueueNext[Queued next on each of its stations]
  QueueNext --> FreeRotation[Plays in free rotation with artist spacing]
  ApprovedSong --> PlacementDecision{Placements bought}
  PlacementDecision -->|Yes| PaidRotation[Credited tier when a station runs paid mode]
  PlacementDecision -->|No| TrialOnly[Trial plays, then opt-in tier]
  RejectedSong --> NotifyArtist[Notify artist]
```

## AD2 Playback and Vote Processing

```mermaid
flowchart TD
  PlayerStart([Open player]) --> GetCurrentTrack[GET radio current]
  GetCurrentTrack --> PlayAudio[Start playback]
  PlayAudio --> SendPresence[POST radio presence or heartbeat]
  SendPresence --> TrackChanged{Track changed}
  TrackChanged -->|No| SendPresence
  TrackChanged -->|Yes| RefreshCurrent[GET radio current]
  RefreshCurrent --> PlayAudio
  PlayAudio --> SongEnded{Song ended before server advanced}
  SongEnded -->|Yes| ForceNext[GET radio next with force and after]
  ForceNext --> PlayAudio
  PlayAudio --> QueueEvent[queue_updated broadcast]
  QueueEvent --> RefreshCurrent
  PlayAudio --> VoteDecision{User votes}
  VoteDecision -->|Yes| PostVote[POST leaderboard vote with play_id]
  PostVote --> Counted{Counts toward score}
  Counted -->|Yes| TempRefresh[Refresh temperature]
  Counted -->|No| FlagCheck[Kept, logged to activity_flags when suspicious]
  TempRefresh --> RefreshCurrent
  FlagCheck --> RefreshCurrent
  VoteDecision -->|No| SendPresence
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
  FetchProfile --> PhoneGate{Phone code needed}
  PhoneGate -->|Yes| VerifyPhone[Verify SMS code]
  PhoneGate -->|No| ProfileReady[Authenticated app state]
  VerifyPhone --> ProfileReady
  ProfileReady --> OtherDomain{Open the other domain}
  OtherDomain -->|Yes| Handoff[Cross-domain token, then exchange for a custom token]
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
    WebClient[Web Next.js on Vercel: networxradio.com and pro-networx.com]
    MobileClient[Flutter mobile]
    AdminClient[Admin Next.js]
  end

  subgraph services [Backend services on Railway]
    ApiServer[NestJS API]
    RedisState[Redis state, locks, BullMQ]
  end

  subgraph supabase [Supabase]
    PgData[Postgres]
    Storage[Storage]
    Realtime[Realtime channels]
  end

  FirebaseStack[Firebase Auth and FCM]
  StripeStack[Stripe payments, Connect, webhooks]
  StoreStack[App Store and Google Play]
  StreamStack[Cloudflare Stream and R2]
  SmsStack[Twilio SMS]
  SentryStack[Sentry]

  WebClient --> ApiServer
  MobileClient --> ApiServer
  AdminClient --> ApiServer
  WebClient -.-> Realtime
  MobileClient -.-> Realtime
  ApiServer --> RedisState
  ApiServer --> PgData
  ApiServer --> Storage
  ApiServer --> Realtime
  ApiServer --> FirebaseStack
  ApiServer --> StripeStack
  ApiServer --> StoreStack
  ApiServer --> StreamStack
  ApiServer --> SmsStack
  ApiServer --> SentryStack
  MobileClient --> SentryStack
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
  users ||--o{ song_listener_ratings : rates
  songs ||--o{ song_listener_ratings : rated_by
  users ||--o{ activity_flags : flagged

  users {
    uuid id PK
    text role
    text_array user_roles
  }

  leaderboard_likes {
    uuid id PK
    uuid user_id FK
    uuid song_id FK
    uuid play_id FK
    text reaction
    text voter_cohort
    boolean counts_toward_score
    timestamptz created_at
  }

  song_listener_ratings {
    uuid user_id PK
    uuid song_id PK
    smallint rating
    text voter_cohort
    boolean counts_toward_score
  }

  song_temperature {
    uuid song_id PK
    int fire_votes
    int shit_votes
    int total_votes
    int temperature_percent
    int popular_temperature_percent
    int peer_temperature_percent
    numeric popular_rating_avg
    numeric peer_rating_avg
    timestamptz updated_at
  }

  activity_flags {
    uuid id PK
    uuid user_id FK
    text reason
    text detail
    timestamptz created_at
  }
```

## SEQ1 Vote Round Trip

```mermaid
sequenceDiagram
  participant Client as Client
  participant Api as NestAPI
  participant Db as Postgres

  Client->>Api: POST leaderboard vote (song_id, play_id, reaction)
  Api->>Db: check listen history and recent vote rate
  alt same reaction as before
    Api->>Db: delete leaderboard_likes row
  else new or switched reaction
    Api->>Db: upsert leaderboard_likes with cohort and counts_toward_score
  end
  Api->>Db: refresh song_temperature
  Db-->>Api: updated temperature stats
  Api-->>Client: vote result with previousReaction
  Client->>Api: GET radio current
  Api->>Db: fetch current song plus temperature
  Api-->>Client: now playing with temperature_percent, popular and peer splits
```

---

Updated: November 23, 2026
