# Quick Setup Guide

## Prerequisites Setup

### 1. Firebase Setup
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication with Email/Password, Google, and Apple providers
3. Download service account key (Settings > Service Accounts > Generate New Private Key)
4. Add Firebase config to mobile app (google-services.json for Android, GoogleService-Info.plist for iOS)

### 2. Supabase Setup
1. Create a Supabase project at https://supabase.com
2. Run the SQL from `docs/database-schema.md` in the SQL Editor
3. Create storage buckets:
   - Go to Storage > Create Bucket
   - Create bucket named `songs` (public)
   - Create bucket named `artwork` (public)
4. Note your project URL and service role key

### 3. Stripe Setup
1. Create a Stripe account at https://stripe.com
2. Get your API keys from Dashboard > Developers > API keys
3. Set up webhook endpoint: `https://your-domain.com/api/payments/webhook`
4. Select event: `payment_intent.succeeded`
5. Copy webhook signing secret

## Backend Setup

```bash
cd backend
npm install
# Create .env file with your credentials
npm run start:dev
```

Backend runs on http://localhost:3000

## Mobile App Setup

```bash
cd mobile
flutter pub get
# Add Firebase config files
# Create .env file
flutter run
```

## Admin Dashboard Setup

```bash
cd admin
npm install
# Create .env.local file
npm run dev
```

Admin dashboard runs on http://localhost:3001

## Testing the Application

1. **Sign Up**: Create an account as an artist
2. **Upload Song**: Go to Upload screen and upload a song
3. **Purchase Credits**: Go to Payment screen and purchase credits (use Stripe test card: 4242 4242 4242 4242)
4. **Listen**: Go to Player screen to listen to the radio stream
5. **Admin**: Approve songs in Supabase dashboard (set status to 'approved')

## Important Notes

- Songs need to be approved (status='approved') before they appear in rotation
- Credits must be assigned to songs (update credits_remaining in songs table)
- Webhook URL must be publicly accessible for Stripe payments to work
- For local development, use ngrok or similar to expose webhook endpoint
