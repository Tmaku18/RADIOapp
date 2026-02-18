# Database Schema (Supabase PostgreSQL)

## Tables

### users
Stores user profiles and authentication information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('listener', 'artist', 'admin')),
  avatar_url TEXT,
  is_banned BOOLEAN DEFAULT FALSE,
  banned_at TIMESTAMPTZ,
  ban_reason TEXT,
  banned_by UUID REFERENCES users(id),
  is_shadow_banned BOOLEAN DEFAULT FALSE,
  shadow_banned_at TIMESTAMPTZ,
  shadow_ban_reason TEXT,
  shadow_banned_by UUID REFERENCES users(id),
  shadow_banned_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_banned ON users(is_banned) WHERE is_banned = TRUE;
CREATE INDEX idx_users_shadow_banned ON users(is_shadow_banned) WHERE is_shadow_banned = TRUE;
```

### songs
Stores song metadata and file references.

```sql
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  artwork_url TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  credits_remaining INTEGER DEFAULT 0,
  play_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  skip_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  fallback_eligible BOOLEAN DEFAULT FALSE,
  opt_in_free_play BOOLEAN DEFAULT FALSE,
  last_played_at TIMESTAMPTZ,
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ,
  trial_plays_remaining INTEGER DEFAULT 3,
  trial_plays_used INTEGER DEFAULT 0,
  status_changed_by UUID REFERENCES users(id),
  status_changed_at TIMESTAMPTZ,
  status_change_reason TEXT,
  admin_free_rotation BOOLEAN DEFAULT FALSE,
  paid_play_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_songs_artist_id ON songs(artist_id);
CREATE INDEX idx_songs_status ON songs(status);
CREATE INDEX idx_songs_credits ON songs(credits_remaining) WHERE credits_remaining > 0;
CREATE INDEX idx_songs_created_at ON songs(created_at DESC);
CREATE INDEX idx_songs_free_rotation 
  ON songs(admin_free_rotation, opt_in_free_play, paid_play_count) 
  WHERE status = 'approved';
```

### plays
Tracks play history for rotation algorithm. When a song ends (next track starts), per-play metrics are filled for "Your song has been played" analytics.

```sql
CREATE TABLE plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ DEFAULT NOW(),
  listener_count INTEGER DEFAULT 1,
  skipped BOOLEAN DEFAULT FALSE,
  listener_count_at_end INTEGER,
  likes_during INTEGER NOT NULL DEFAULT 0,
  comments_during INTEGER NOT NULL DEFAULT 0,
  disconnects_during INTEGER NOT NULL DEFAULT 0,
  profile_clicks_during INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_plays_song_id ON plays(song_id);
CREATE INDEX idx_plays_played_at ON plays(played_at DESC);
```

- `listener_count`: listeners when the play started.
- `listener_count_at_end`, `likes_during`, `comments_during`, `disconnects_during`, `profile_clicks_during`: set when the next track starts (finalize step).

### likes
Tracks user likes for engagement metrics.

```sql
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_song_id ON likes(song_id);
```

### subscriptions
Artist subscription plans (planned; schema reserved).

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  credits_per_period INTEGER NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_artist_id ON subscriptions(artist_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### transactions
Stripe payment records. Two flows:

- **Credit bank (legacy):** `credits_purchased` set; on success, `increment_credits` RPC adds to artist balance.
- **Per-song plays:** `song_id` and `plays_purchased` set; pricing is **$1 per minute per play** (rounded up to nearest cent). On success, `songs.credits_remaining` is increased by `plays_purchased` for that song. Purchase options: 1, 3, 5, 10, 25, 50, 100 plays.

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT,
  stripe_charge_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  credits_purchased INTEGER NOT NULL,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  plays_purchased INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_stripe_payment_intent_id ON transactions(stripe_payment_intent_id);
CREATE INDEX idx_transactions_song_id ON transactions(song_id);
CREATE INDEX idx_transactions_stripe_checkout_session_id ON transactions(stripe_checkout_session_id);
```

### credits
Artist play credits balance (denormalized for performance).

```sql
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0 CHECK (balance >= 0),
  total_purchased INTEGER DEFAULT 0,
  total_used INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credits_artist_id ON credits(artist_id);
CREATE INDEX idx_credits_balance ON credits(balance) WHERE balance > 0;
```

### rotation_queue
Current rotation state (can be replaced with Redis in production).

```sql
CREATE TABLE rotation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  priority_score DECIMAL NOT NULL,
  played_at TIMESTAMPTZ,
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rotation_queue_priority ON rotation_queue(priority_score DESC);
CREATE INDEX idx_rotation_queue_played_at ON rotation_queue(played_at DESC NULLS LAST);
```

### notifications
In-app notification records with soft delete support.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### play_decision_log
Audit trail for radio song selection decisions.

```sql
CREATE TABLE play_decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  selection_reason TEXT NOT NULL,
  tier_at_selection TEXT,
  listener_count INTEGER,
  weight_score DECIMAL(10, 4),
  random_seed TEXT,
  competing_songs INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### admin_fallback_songs
Admin-curated free rotation tracks.

```sql
CREATE TABLE admin_fallback_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  artwork_url TEXT,
  duration_seconds INTEGER DEFAULT 180,
  is_active BOOLEAN DEFAULT TRUE,
  play_count INTEGER DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### radio_playlist_state
Persistent state for free rotation stack and playlist type.

```sql
CREATE TABLE radio_playlist_state (
  id TEXT PRIMARY KEY,
  playlist_type TEXT NOT NULL DEFAULT 'free_rotation',
  fallback_stack JSONB DEFAULT '[]'::jsonb,
  fallback_position INTEGER DEFAULT 0,
  stack_version_hash TEXT,
  songs_played_since_checkpoint INTEGER DEFAULT 0,
  last_switched_at TIMESTAMPTZ,
  last_checkpoint_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### credit_allocations
Ledger for credit allocation/withdrawal events.

```sql
CREATE TABLE credit_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  direction TEXT NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### artist_notification_cooldowns
Per-artist cooldown tracking for push notifications.

```sql
CREATE TABLE artist_notification_cooldowns (
  artist_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_push_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_count_today INTEGER DEFAULT 1
);
```

### chat_messages
Live chat messages (hot storage).

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  message TEXT NOT NULL CHECK (char_length(message) <= 280),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### chat_archives
Archived chat messages (cold storage).

```sql
CREATE TABLE chat_archives (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  song_id UUID,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);
```

### chat_config
Global chat configuration and kill switch.

```sql
CREATE TABLE chat_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  enabled BOOLEAN DEFAULT TRUE,
  disabled_reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### profile_clicks
Tracks when a listener clicks the artist's profile from the radio player (for per-play analytics: "profile clicks during this play").

```sql
CREATE TABLE profile_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profile_clicks_song_created ON profile_clicks(song_id, created_at);
CREATE INDEX idx_profile_clicks_artist_created ON profile_clicks(artist_id, created_at);
```

### artist_follows
Tracks follows from listeners to artists (used for ROI and artist growth analytics).

```sql
CREATE TABLE artist_follows (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, artist_id),
  CHECK (user_id != artist_id)
);

CREATE INDEX idx_artist_follows_artist ON artist_follows(artist_id);
```

### service_providers (Pro-Directory)
Service provider profiles (Industry Catalysts), including optional geo fields for nearby search.

```sql
CREATE TABLE service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  location_region TEXT,
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  hero_image_url TEXT,
  instagram_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  mentor_opt_in BOOLEAN DEFAULT false,
  location_geo geography(POINT),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_providers_location_geo ON service_providers USING GIST (location_geo);
```

### service_provider_types
Provider “tags” for service types (e.g., photo, video, mixing).

```sql
CREATE TABLE service_provider_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, service_type)
);
```

### service_listings
Service menu items shown on provider profiles.

```sql
CREATE TABLE service_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  rate_cents INTEGER,
  rate_type TEXT DEFAULT 'fixed' CHECK (rate_type IN ('hourly', 'fixed')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_listings_provider ON service_listings(provider_id);
CREATE INDEX idx_service_listings_type_status ON service_listings(service_type, status);
```

### provider_portfolio_items
Provider portfolio (image/audio/video). Used in the Pro‑Directory profile UI.

```sql
CREATE TABLE provider_portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'audio', 'video')),
  file_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provider_portfolio_user ON provider_portfolio_items(user_id);
```

### venue_ads
Venue partner slots displayed on listen/player surfaces.

```sql
CREATE TABLE venue_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT DEFAULT 'global',
  image_url TEXT NOT NULL,
  link_url TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_venue_ads_schedule ON venue_ads(station_id, start_at, end_at) WHERE is_active = true;
```

### song_catalyst_credits
Pinned “Catalyst” credits surfaced during a song’s airtime.

```sql
CREATE TABLE song_catalyst_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'cover_art' CHECK (role IN ('cover_art', 'video', 'production', 'photo', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, user_id, role)
);

CREATE INDEX idx_song_catalyst_credits_song ON song_catalyst_credits(song_id);
CREATE INDEX idx_song_catalyst_credits_user ON song_catalyst_credits(user_id);
```

### station_events (realtime)
Station-wide realtime events (currently includes `rising_star`), consumed by web/mobile listen surfaces.

```sql
CREATE TABLE station_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT NOT NULL DEFAULT 'global',
  type TEXT NOT NULL CHECK (type IN ('rising_star')),
  play_id UUID REFERENCES plays(id) ON DELETE SET NULL,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uniq_station_events_type_play ON station_events(type, play_id);
CREATE INDEX idx_station_events_station_created_at ON station_events(station_id, created_at DESC);
```

## Functions and Triggers

### Update updated_at timestamp
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Initialize credits on user creation
```sql
CREATE OR REPLACE FUNCTION initialize_artist_credits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'artist' THEN
    INSERT INTO credits (artist_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER initialize_credits_on_user_create
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION initialize_artist_credits();
```

### Update song like count
```sql
CREATE OR REPLACE FUNCTION update_song_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE songs SET like_count = like_count + 1 WHERE id = NEW.song_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE songs SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.song_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_like_count_on_like
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_song_like_count();
```

### Atomic credit increment (prevents race conditions)
```sql
CREATE OR REPLACE FUNCTION increment_credits(
  p_artist_id UUID,
  p_amount INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE credits 
  SET balance = balance + p_amount,
      total_purchased = total_purchased + p_amount,
      updated_at = NOW()
  WHERE artist_id = p_artist_id;
  
  -- Create credit record if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO credits (artist_id, balance, total_purchased)
    VALUES (p_artist_id, p_amount, p_amount);
  END IF;
END;
$$ LANGUAGE plpgsql;
```

## Row Level Security (RLS)

Enable RLS on all tables and create policies as needed for Supabase.

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotation_queue ENABLE ROW LEVEL SECURITY;
```
