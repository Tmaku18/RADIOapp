# NETWORX Platform — Use Case and Activity UML Diagrams

**Product:** NETWORX Radio: The Butterfly Effect  
**Tagline:** By artists, for artists.

This document contains Use Case diagrams and Activity diagrams for all platform scenarios. Diagrams use Mermaid syntax and render in GitHub, VS Code, and most markdown viewers.

---

## Actors

| Actor | Description |
|-------|-------------|
| **Listener (Prospector)** | Authenticated user who listens to radio, votes, earns Yield, uses Refinery |
| **Artist** | Content creator; can upload songs, allocate credits, go live, view analytics |
| **Catalysts (service providers)** | Pro-NETWORX professional; listed in directory, receives DMs and job applications |
| **Admin** | Platform administrator; moderation, user management, radio control |
| **System** | Automated backend processes (cron, webhooks, push) |

---

## Part 1: Use Case Diagrams

### UC1: Authentication System

```mermaid
flowchart LR
    subgraph actors [Actors]
        Guest((Guest))
        User((User))
    end

    subgraph auth_system [Authentication System]
        SignUp([Sign Up])
        SignIn([Sign In])
        SignOut([Sign Out])
        RequestArtistUpgrade([Request Artist Upgrade])
    end

    subgraph auth_methods [Sign-In Methods]
        SignInEmail([Email/Password])
        SignInGoogle([Google OAuth])
        SignInApple([Apple Sign-In])
    end

    Guest --> SignUp
    Guest --> SignIn
    SignIn --> SignInEmail
    SignIn --> SignInGoogle
    SignIn --> SignInApple
    User --> SignOut
    User --> RequestArtistUpgrade
```

---

### UC2: Live Radio (All Users)

```mermaid
flowchart LR
    subgraph actors [Actors]
        Listener((Listener))
        Artist((Artist))
    end

    subgraph radio [Live Radio]
        ListenToRadio([Listen to Radio])
        ViewNowPlaying([View Now Playing])
        SendHeartbeat([Send Heartbeat])
        VoteRipple([Vote / Ripple on Track])
        LiveChat([Participate in Live Chat])
        EmojiReactions([Send Emoji Reactions])
        ViewLeaderboards([View Leaderboards])
    end

    Listener --> ListenToRadio
    Listener --> ViewNowPlaying
    Listener --> SendHeartbeat
    Listener --> VoteRipple
    Listener --> LiveChat
    Listener --> EmojiReactions
    Listener --> ViewLeaderboards
    Artist --> ListenToRadio
    Artist --> ViewNowPlaying
    Artist --> SendHeartbeat
    Artist --> VoteRipple
    Artist --> LiveChat
    Artist --> EmojiReactions
    Artist --> ViewLeaderboards
```

---

### UC3: Artist Content Management

```mermaid
flowchart LR
    subgraph actor [Actor]
        Artist((Artist))
    end

    subgraph content [Content Management]
        UploadSong([Upload Song])
        ViewUploadStatus([View Upload Status])
        AllocateCredits([Allocate Credits to Song])
        AddToRefinery([Add Song to Refinery])
        ViewDiscography([View Discography])
        GoLive([Go Live])
        StopLive([Stop Livestream])
        ReceiveDonations([Receive Donations])
        QuickAddMinutes([Quick Add 5 Minutes])
    end

    Artist --> UploadSong
    Artist --> ViewUploadStatus
    Artist --> AllocateCredits
    Artist --> AddToRefinery
    Artist --> ViewDiscography
    Artist --> GoLive
    Artist --> StopLive
    Artist --> ReceiveDonations
    Artist --> QuickAddMinutes
```

---

### UC4: Prospector Rewards (The Yield)

```mermaid
flowchart LR
    subgraph actor [Actor]
        Prospector((Prospector))
    end

    subgraph yield [The Yield]
        CheckIn([Check-In])
        RateRefinerySong([Rate Song in Refinery 1-10])
        SubmitSurvey([Submit Survey])
        ViewYieldBalance([View Yield Balance])
        RedeemRewards([Redeem $5 or $10 Visa])
        ViewRewardsCenter([Rewards Command Center])
    end

    Prospector --> CheckIn
    Prospector --> RateRefinerySong
    Prospector --> SubmitSurvey
    Prospector --> ViewYieldBalance
    Prospector --> RedeemRewards
    Prospector --> ViewRewardsCenter
```

---

### UC5: Credits and Payments

```mermaid
flowchart LR
    subgraph actors [Actors]
        Artist((Artist))
        Prospector((Prospector))
    end

    subgraph payments [Credits and Payments]
        ViewCreditBalance([View Credit Balance])
        BuyCredits([Buy Credits])
        BuySongPlays([Buy Song Plays])
        QuickAdd5Min([Quick Add 5 Minutes])
        SubscribeCreatorNetwork([Subscribe to Creator Network])
        ViewTransactions([View Transactions])
        StreamDonation([Send Stream Donation])
    end

    Artist --> ViewCreditBalance
    Artist --> BuyCredits
    Artist --> BuySongPlays
    Artist --> QuickAdd5Min
    Artist --> ViewTransactions
    Artist --> StreamDonation
    Prospector --> SubscribeCreatorNetwork
    Prospector --> ViewTransactions
```

---

### UC6: Analytics (The Wake)

```mermaid
flowchart LR
    subgraph actor [Actor]
        Artist((Artist))
        Prospector((Prospector))
    end

    subgraph analytics [The Wake]
        ViewPlaysLikes([View Plays and Likes Summary])
        ViewROI([View ROI])
        ViewHeatmap([View Listener Heatmap])
        ToggleDiscoverable([Toggle Discoverable Status])
    end

    Artist --> ViewPlaysLikes
    Artist --> ViewROI
    Artist --> ViewHeatmap
    Prospector --> ToggleDiscoverable
```

---

### UC7: Discovery and Pro-Directory

```mermaid
flowchart LR
    subgraph actors [Actors]
        Listener((Listener))
        ServiceProvider((Catalysts (service providers)))
    end

    subgraph discovery [Discovery and Pro-Directory]
        BrowsePeople([Browse People])
        SearchByFilters([Search by Filters])
        ViewProviderProfile([View Provider Profile])
        NearbySearch([Nearby Search - Mobile])
        EditProProfile([Edit Pro-NETWORX Profile])
        CompleteOnboarding([Complete Onboarding])
    end

    Listener --> BrowsePeople
    Listener --> SearchByFilters
    Listener --> ViewProviderProfile
    Listener --> NearbySearch
    ServiceProvider --> EditProProfile
    ServiceProvider --> CompleteOnboarding
    ServiceProvider --> ViewProviderProfile
```

---

### UC8: Messaging and Creator Network

```mermaid
flowchart LR
    subgraph actors [Actors]
        User((User))
        ServiceProvider((Catalysts (service providers)))
    end

    subgraph messaging [Messaging and Creator Network]
        ViewConversations([View Conversations])
        SendMessage([Send Message])
        ViewJobBoard([View Job Board])
        ApplyToJob([Apply to Job])
    end

    User --> ViewConversations
    User --> SendMessage
    User --> ViewJobBoard
    User --> ApplyToJob
    ServiceProvider --> ViewConversations
    ServiceProvider --> SendMessage
    ServiceProvider --> ViewJobBoard
    ServiceProvider --> ApplyToJob
```

**Note:** Send Message requires active Creator Network subscription (paywall).

---

### UC9: Admin Operations

```mermaid
flowchart LR
    subgraph actor [Actor]
        Admin((Admin))
    end

    subgraph admin_ops [Admin Operations]
        ModerateSongs([Moderate Songs])
        ManageUsers([Manage Users])
        ManageFallback([Manage Fallback Playlist])
        ToggleFreeRotation([Toggle Free Rotation])
        OverrideRadioQueue([Override Radio Queue])
        ForceStopLivestream([Force-Stop Livestream])
        ViewPlatformAnalytics([View Platform Analytics])
        ArtistLiveBan([Set Artist Live Ban])
    end

    Admin --> ModerateSongs
    Admin --> ManageUsers
    Admin --> ManageFallback
    Admin --> ToggleFreeRotation
    Admin --> OverrideRadioQueue
    Admin --> ForceStopLivestream
    Admin --> ViewPlatformAnalytics
    Admin --> ArtistLiveBan
```

---

## Part 2: Activity Diagrams

### AD1: User Registration Flow

```mermaid
flowchart TD
    Start([Start]) --> ChooseMethod{Choose sign-up method}
    ChooseMethod -->|Email| EnterEmail[Enter email and password]
    ChooseMethod -->|Google| GoogleOAuth[Google OAuth flow]
    ChooseMethod -->|Apple| AppleOAuth[Apple Sign-In flow]

    EnterEmail --> CreateFirebaseUser[Create Firebase user]
    GoogleOAuth --> CreateFirebaseUser
    AppleOAuth --> CreateFirebaseUser

    CreateFirebaseUser --> CreateBackendProfile[POST /users - create profile]
    CreateBackendProfile --> SetRole[Set role: listener or artist]
    SetRole --> Success([User registered])

    CreateBackendProfile -->|Error| HandleError[Show error / retry]
    HandleError --> CreateBackendProfile
```

---

### AD2: Song Upload and Approval Flow

```mermaid
flowchart TD
    Start([Artist: Upload Song]) --> RequestSignedUrl[POST /uploads/signed-url]
    RequestSignedUrl --> UploadToStorage[PUT file to signed URL - Supabase Storage]
    UploadToStorage --> SubmitMetadata[POST /songs with metadata and paths]
    SubmitMetadata --> SongPending[Song status: pending]

    SongPending --> AdminReview{Admin reviews}
    AdminReview -->|Approve| SongApproved[Song status: approved]
    AdminReview -->|Reject| SongRejected[Song status: rejected]
    AdminReview -->|Delete| SongDeleted[Remove from DB and storage]

    SongApproved --> TrialPlays[Track enters trial rotation]
    TrialPlays --> ArtistAllocates{Artist allocates credits?}
    ArtistAllocates -->|Yes| PaidRotation[Track in paid rotation]
    ArtistAllocates -->|No| TrialOnly[Trial plays only until exhausted]

    SongRejected --> NotifyArtist[Artist notified]
    SongDeleted --> NotifyArtist
```

---

### AD3: Live Radio Playback Flow

```mermaid
flowchart TD
    Start([User opens Listen/Player]) --> GetCurrent[GET /radio/current]
    GetCurrent --> ReceiveState[Receive current track, playId, streamUrl]
    ReceiveState --> LoadStream[Load audio stream from Storage]
    LoadStream --> StartPlayback[Start playback]

    StartPlayback --> HeartbeatLoop[Every 30s: POST /radio/heartbeat]
    HeartbeatLoop --> TrackChange{Track changed?}
    TrackChange -->|Yes| ReportPlay[POST /radio/play]
    ReportPlay --> GetCurrent
    TrackChange -->|No| HeartbeatLoop

    StartPlayback --> UserVote{User votes?}
    UserVote -->|Yes| PostLike[POST /leaderboard/songs/:id/like with playId and reaction]
    PostLike --> DbVote[leaderboard_likes upsert + refresh_song_temperature]
    DbVote --> MaybeLib[Fire votes may INSERT likes library row]
    MaybeLib --> PollTemp[Clients read temperature via GET /radio/current]
    PollTemp --> StartPlayback
    UserVote -->|No| StartPlayback
```

---

### AD4: Credit Purchase Flow (Web vs Mobile)

```mermaid
flowchart TD
    Start([User: Buy Credits]) --> ChoosePlatform{Platform?}
    ChoosePlatform -->|Web| WebCheckout[POST /payments/create-checkout-session]
    ChoosePlatform -->|Mobile| MobileIntent[POST /payments/create-payment-intent]

    WebCheckout --> RedirectStripe[Redirect to Stripe Checkout]
    RedirectStripe --> UserPaysWeb[User completes payment on Stripe]
    UserPaysWeb --> Webhook1[Webhook: checkout.session.completed]

    MobileIntent --> ReceiveClientSecret[Receive client secret]
    ReceiveClientSecret --> ConfirmSheet[Stripe Payment Sheet - confirm]
    ConfirmSheet --> UserPaysMobile[User completes payment]
    UserPaysMobile --> Webhook2[Webhook: payment_intent.succeeded]

    Webhook1 --> CreditBalance[Update user credit balance in DB]
    Webhook2 --> CreditBalance
    CreditBalance --> Success([Credits added])
```

---

### AD5: Ripple / radio vote flow

```mermaid
flowchart TD
    Start([Listener: Vote on track]) --> HasPlayId{Has current playId?}
    HasPlayId -->|No| GetCurrent[GET /radio/current]
    GetCurrent --> HasPlayId
    HasPlayId -->|Yes| HasRow{Existing row for user plus play?}
    HasRow -->|No| PostLike[POST /leaderboard/songs/:id/like with playId and reaction]
    HasRow -->|Yes| UpdateReact[Update reaction fire or shit same row]
    PostLike --> BackendValidate[Backend: validate user playId songId]
    UpdateReact --> BackendValidate
    BackendValidate --> InsertLL[Insert or update leaderboard_likes]
    InsertLL --> TriggerRefresh[DB trigger refresh_song_temperature]
    TriggerRefresh --> CacheRow[Upsert song_temperature decayed totals]
    CacheRow --> MaybeSave[If fire ensure likes library row]
    MaybeSave --> RealtimeOptional[Optional Realtime likes INSERT for visuals]
    RealtimeOptional --> CheckRisingStar{Conversion to votes ge 5 percent?}
    CheckRisingStar -->|Yes| EmitRisingStar[Emit Rising Star station_event]
    EmitRisingStar --> Success([Vote recorded])
    CheckRisingStar -->|No| Success
```

---

### AD6: Yield Redemption Flow

```mermaid
flowchart TD
    Start([Prospector: Redeem rewards]) --> CheckBalance[GET /yield/balance]
    CheckBalance --> BalanceCheck{Balance >= threshold?}
    BalanceCheck -->|No| ShowProgress([Show progress to $5 or $10])
    BalanceCheck -->|Yes| ChooseAmount{Choose $5 or $10}
    ChooseAmount --> SubmitRedeem[POST /yield/redeem with request_id and amount]
    SubmitRedeem --> IdempotentCheck{request_id already used?}
    IdempotentCheck -->|Yes| ReturnExisting([Return existing redemption])
    IdempotentCheck -->|No| DebitBalance[Debit balance atomically]
    DebitBalance --> CallRPC[Call redeem_prospector_yield RPC]
    CallRPC --> ExternalVendor[Trigger Virtual Visa issuance]
    ExternalVendor --> RecordRedemption[Record in redemptions table]
    RecordRedemption --> Success([Redemption successful])
```

---

### AD7: Artist Livestream Flow

```mermaid
flowchart TD
    Start([Artist: Go Live]) --> CheckEligible{Allowed to go live?}
    CheckEligible -->|Banned/No| Deny([Denied])
    CheckEligible -->|Yes| PostStart[POST /artist-live/start]
    PostStart --> BackendCreate[Backend: create session, get Cloudflare Stream input]
    BackendCreate --> ReturnWatchUrl[Return watch URL and stream key]
    ReturnWatchUrl --> ArtistStreams[Artist streams to Cloudflare]
    ArtistStreams --> WebhookLifecycle[Webhook: stream live/end]
    WebhookLifecycle --> UpdateStatus[Update session status in DB]

    ViewerWatch([Viewer: Watch live]) --> GetStatus[GET /artist-live/:artistId/status]
    GetStatus --> IsLive{Artist live?}
    IsLive -->|No| ShowOffline([Show offline])
    IsLive -->|Yes| GetWatchUrl[GET /artist-live/:artistId/watch]
    GetWatchUrl --> JoinSession[POST /artist-live/:sessionId/join]
    JoinSession --> PlayHLS[Play HLS stream]
    PlayHLS --> DonateOption{Send donation?}
    DonateOption -->|Yes| DonationFlow[Stripe donation intent]
    DonateOption -->|No| Watching([Watching])
    DonationFlow --> Watching

    ArtistStop([Artist: Stop live]) --> PostStop[POST /artist-live/stop]
    PostStop --> WebhookEnd[Webhook: stream end]
    WebhookEnd --> SessionClosed([Session closed])
```

---

### AD8: Song Rotation Selection (Backend)

```mermaid
flowchart TD
    Start([Track ends - select next]) --> GetQueue[Get eligible queue from Redis/DB]
    GetQueue --> QueueEmpty{Queue empty?}
    QueueEmpty -->|Yes| UseFallback[Select from admin fallback playlist]
    UseFallback --> LogDecision[Log to play_decision_log]
    QueueEmpty -->|No| ApplyRules[Apply selection rules]

    ApplyRules --> TrialEligible{Any trial plays left?}
    TrialEligible -->|Yes| ConsiderTrial[Weight trial tracks]
    TrialEligible -->|No| ConsiderPaid[Consider only paid-rotation tracks]

    ConsiderTrial --> ConsiderPaid
    ConsiderPaid --> PopularityWeight[Apply popularity weighting with caps]
    PopularityWeight --> DeterministicPick[Deterministic shuffle / pick]
    DeterministicPick --> PreChargeCredits{Credits required?}
    PreChargeCredits -->|Yes| AtomicCharge[Atomically pre-charge credits]
    AtomicCharge --> ChargeOK{Charge success?}
    ChargeOK -->|No| SkipTrack[Skip to next candidate]
    SkipTrack --> ApplyRules
    ChargeOK -->|Yes| SelectTrack[Select track]
    PreChargeCredits -->|No| SelectTrack
    SelectTrack --> LogDecision
    LogDecision --> UpdateRedis[Update Redis: current, next]
    UpdateRedis --> End([Next track set])
    UseFallback --> UpdateRedis
```

---

### AD9: Refinery Rating Flow

```mermaid
flowchart TD
    Start([Prospector: Rate Refinery song]) --> ListSongs[GET /refinery/songs]
    ListSongs --> SelectSong[Select song to rate]
    SelectSong --> PlayUnlimited[Play song - unlimited listens]
    PlayUnlimited --> SubmitScore[POST /prospector/refinement with songId and score 1-10]
    SubmitScore --> IdempotentRefinement{Already scored?}
    IdempotentRefinement -->|Yes| ReturnExisting([Return existing score])
    IdempotentRefinement -->|No| SaveScore[Save refinement score]
    SaveScore --> CreditYield[Credit Yield to Prospector]
    CreditYield --> OptionalSurvey{Survey available?}
    OptionalSurvey -->|Yes| SubmitSurvey[POST /prospector/survey]
    OptionalSurvey -->|No| Success([Rating saved])
    SubmitSurvey --> CreditYieldSurvey[Credit additional Yield]
    CreditYieldSurvey --> Success
```

---

### AD10: Creator Network Message Flow

```mermaid
flowchart TD
    Start([User: Send message]) --> CheckSubscription{Active Creator Network subscription?}
    CheckSubscription -->|No| ShowPaywall([Show paywall - subscribe to message])
    CheckSubscription -->|Yes| LoadThreads[GET conversations / threads]
    LoadThreads --> SelectThread[Select or create conversation]
    SelectThread --> ComposeMessage[Compose message]
    ComposeMessage --> SendMessage[POST send message]
    SendMessage --> BackendValidate[Backend: validate subscription]
    BackendValidate --> StoreMessage[Store message in DB]
    StoreMessage --> NotifyRecipient[Notify recipient - in-app or push]
    NotifyRecipient --> Success([Message sent])

    JobBoard([User: Apply to job]) --> ViewJobs[View job board]
    ViewJobs --> SelectJob[Select job request]
    SelectJob --> SubmitApplication[Submit application]
    SubmitApplication --> NotifyProvider[Notify catalyst]
    NotifyProvider --> JobApplied([Application sent])
```

---

## Part 4: Architecture, schema, and flows (Mermaid)

### ARCH1: Containers (web, mobile, backend, data stores)

```mermaid
flowchart TB
  subgraph clients [Clients]
    Web[Web Next.js]
    Mobile[Flutter]
  end

  subgraph api [NestJS API]
    Radio[Radio]
    LB[Leaderboard]
    Songs[Songs]
  end

  Redis[("Redis")]
  Supabase[("Supabase Postgres + Realtime + Storage")]
  Firebase["Firebase Auth + FCM"]
  Stripe["Stripe payments"]

  Web --> api
  Mobile --> api
  Radio --> Redis
  Radio --> Supabase
  LB --> Supabase
  Songs --> Supabase
  api --> Firebase
  api --> Stripe
```

### ER1: Core entities for radio votes and temperature

```mermaid
erDiagram
  users ||--o{ leaderboard_likes : submits
  songs ||--o{ leaderboard_likes : target
  plays ||--o{ leaderboard_likes : play_scope
  songs ||--o| song_temperature : cache
  users ||--o{ likes : library
  songs ||--o{ likes : saved

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

### SEQ1: Per-play vote, cache refresh, current track read

```mermaid
sequenceDiagram
  participant C as Client
  participant API as NestJS
  participant DB as Supabase Postgres
  C->>API: POST leaderboard songs id like playId reaction
  API->>DB: upsert leaderboard_likes
  Note over DB: trigger trg_refresh_song_temperature
  API->>DB: RPC refresh_song_temperature p_song_id
  API->>DB: select song_temperature by song_id
  API-->>C: liked reaction
  C->>API: GET radio current
  API->>DB: RPC refresh_song_temperature
  API->>DB: select song_temperature
  API-->>C: now playing plus temperature_percent
```

### ACT1: Temperature lifecycle (zero baseline plus decay)

```mermaid
flowchart TD
  N([New or idle song]) --> Z[temperature_percent defaults to 0]
  Z --> V{leaderboard_likes has votes?}
  V -->|no| Z
  V -->|yes| R[refresh_song_temperature recomputes]
  R --> D[Decay each vote by age half-life 24h]
  D --> P[percent equals clamped decayed fire minus decayed shit]
  P --> E[Clients show bar from GET radio current]
  E --> T{Time passes or new vote?}
  T --> R
```

---

## Summary

| Diagram | Type | Scope |
|---------|------|--------|
| UC1 | Use Case | Authentication |
| UC2 | Use Case | Live Radio |
| UC3 | Use Case | Artist Content |
| UC4 | Use Case | The Yield |
| UC5 | Use Case | Credits and Payments |
| UC6 | Use Case | The Wake (Analytics) |
| UC7 | Use Case | Discovery and Pro-Directory |
| UC8 | Use Case | Messaging |
| UC9 | Use Case | Admin Operations |
| AD1 | Activity | User Registration |
| AD2 | Activity | Song Upload and Approval |
| AD3 | Activity | Live Radio Playback |
| AD4 | Activity | Credit Purchase |
| AD5 | Activity | Ripple/Vote |
| AD6 | Activity | Yield Redemption |
| AD7 | Activity | Artist Livestream |
| AD8 | Activity | Song Rotation Selection |
| AD9 | Activity | Refinery Rating |
| AD10 | Activity | Creator Network Messaging |
| ARCH1 | Flowchart | Containers and integrations |
| ER1 | ER diagram | Votes, library, temperature cache |
| SEQ1 | Sequence | Vote, RPC, current track |
| ACT1 | Activity | Temperature decay lifecycle |

*Updated: March 2026 — aligned with migrations 047–049 and leaderboard query modes.*
