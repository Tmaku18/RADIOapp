# API Specification

Base URL: `http://localhost:3000/api`

All endpoints require Firebase ID token in Authorization header: `Authorization: Bearer <token>`

## Authentication

### Verify Token
- **GET** `/auth/verify`
- Returns user info from verified token

## Users

### Get Current User
- **GET** `/users/me`
- Returns current user profile

### Update User Profile
- **PUT** `/users/me`
- Body: `{ displayName?: string, avatarUrl?: string }`

### Get User by ID
- **GET** `/users/:id`
- Returns user profile

## Songs

### Upload Song
- **POST** `/songs/upload`
- Content-Type: `multipart/form-data`
- Fields: `audio` (file), `artwork` (file, optional), `title` (string), `artistName` (string)
- Returns: `{ id, title, artistName, audioUrl, artworkUrl }`

### Get Songs
- **GET** `/songs`
- Query params: `?artistId=uuid&status=approved&limit=20&offset=0`
- Returns: Array of songs

### Get Song by ID
- **GET** `/songs/:id`
- Returns: Song details

### Like Song
- **POST** `/songs/:id/like`
- Toggles like status

### Unlike Song
- **DELETE** `/songs/:id/like`

## Radio

### Get Current Track
- **GET** `/radio/current`
- Returns: Current playing song with metadata

### Get Next Track
- **GET** `/radio/next`
- Returns: Next song in rotation

### Report Play
- **POST** `/radio/play`
- Body: `{ songId: uuid, skipped?: boolean }`
- Logs play event

## Payments

### Create Payment Intent
- **POST** `/payments/create-intent`
- Body: `{ amount: number, credits: number }`
- Returns: `{ clientSecret: string }`

### Webhook (Stripe)
- **POST** `/payments/webhook`
- Handles Stripe webhook events

### Get Transactions
- **GET** `/payments/transactions`
- Returns: User's transaction history

## Credits

### Get Credit Balance
- **GET** `/credits/balance`
- Returns: `{ balance: number, totalPurchased: number, totalUsed: number }`

## Admin (Admin role required)

### Get All Songs
- **GET** `/admin/songs`
- Query params: `?status=pending&limit=50&offset=0`

### Approve/Reject Song
- **PATCH** `/admin/songs/:id`
- Body: `{ status: 'approved' | 'rejected' }`

### Get Analytics
- **GET** `/admin/analytics`
- Returns: Platform statistics

### Get Rotation Queue
- **GET** `/admin/radio/queue`
- Returns: Current rotation queue

### Override Next Track
- **POST** `/admin/radio/override`
- Body: `{ songId: uuid }`
