# Database Schema (Supabase PostgreSQL)

The core tables below (`users`, `songs`, `plays`, `likes`, …) were created in the Supabase project before the migration folder existed; later changes live in `backend/supabase/migrations/` (001–149, applied in numeric order). The backend connects with the service-role key (and a direct `pg` pool via `DATABASE_URL`), so RLS policies matter only for clients that use Supabase directly (realtime and storage).

Schemas: **`public`** for app data, **`pro_networx`** for Pro-Networx profile extensions, and **`storage`** for buckets.

## Tables

### users
Stores user profiles and authentication information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'listener', -- listener | artist | service_provider | dj | musician | admin
  user_roles TEXT[] NOT NULL DEFAULT '{}', -- extra maker roles: artist, service_provider, musician, dj (145)
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
  city TEXT,           -- Nearby People (migration 106)
  zip_code TEXT,       -- Nearby People (migration 106)
  username TEXT,                       -- 082
  display_name_compact TEXT,           -- 149, generated; unique (case/space-insensitive names)
  username_compact TEXT,               -- 149, generated; unique
  auth_user_id UUID,                   -- 087
  phone_e164 TEXT UNIQUE,              -- 146, phone sign-in code
  phone_verified_at TIMESTAMPTZ,       -- 146
  terms_accepted_at TIMESTAMPTZ,       -- 133
  apple_authorization_code TEXT,       -- 134, used to revoke Sign in with Apple on deletion
  deletion_requested_at TIMESTAMPTZ,   -- 148, 48-hour grace period
  deletion_scheduled_for TIMESTAMPTZ,  -- 148
  referral_code TEXT,                  -- 135
  referred_by_user_id UUID,            -- 011
  notifications_enabled BOOLEAN,       -- 110; also notify_new_follower, notify_feed_post_like
  -- 135: notify_messages, notify_live, notify_weekly_digest, quiet_hours_start, quiet_hours_end
  -- 093: notify_followed_artist_on_radio
  -- Profile: bio, region (006), headline, location_region (013), discoverable (019),
  --   social URLs (031/052), artist_lat, artist_lng (042), resume (066), favorite_genres (092)
  -- Payouts: stripe_connect_* (071)
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
  is_explicit BOOLEAN DEFAULT FALSE,
  fallback_eligible BOOLEAN DEFAULT FALSE,
  opt_in_free_play BOOLEAN DEFAULT FALSE,
  -- Full-Song Radio Opt-In Agreement (migration 103)
  opt_in_full_song_radio BOOLEAN NOT NULL DEFAULT FALSE,
  opt_in_dj_livestreams BOOLEAN NOT NULL DEFAULT FALSE,
  opt_in_dj_archived_mixes BOOLEAN NOT NULL DEFAULT FALSE,
  last_played_at TIMESTAMPTZ,
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ,
  trial_plays_remaining INTEGER DEFAULT 3,
  trial_plays_used INTEGER DEFAULT 0,
  status_changed_by UUID REFERENCES users(id),
  status_changed_at TIMESTAMPTZ,
  status_change_reason TEXT,
  admin_free_rotation BOOLEAN DEFAULT FALSE, -- set with is_public when an admin approves
  paid_play_count INTEGER DEFAULT 0,
  station_id TEXT,                -- 032, primary station
  station_ids TEXT[],             -- 046, extra stations
  is_public BOOLEAN,              -- 057
  in_refinery BOOLEAN,            -- 057, plus refinery_* fields
  copyright_status TEXT,          -- 070, ACRCloud scan result; also copyright_checked_at, copyright_match
  price_cents INTEGER,            -- 071; 117 limits it to 99, 199, 299, 499, 999, 1999, 2999, 4999
  is_for_sale BOOLEAN,            -- 071; also sample_start, sample_end, sample_url
  product_kind TEXT DEFAULT 'song', -- 114, 'song' | 'beat'
  opt_in_pro_radio BOOLEAN,       -- 120/122, on-demand in Pro-Radio
  album_id UUID,                  -- 123, references albums
  track_number INTEGER,           -- 123
  -- Also: artist_origin_city/state (039), discover_* clip fields (035/045),
  --   spotlight_listen_count (006), profile_play_count (017)
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
CREATE INDEX idx_songs_status_explicit ON songs(status, is_explicit);
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

### leaderboard_likes
Per-user votes tied to a **radio play** (or legacy song-level rows). One row per `(user_id, play_id)` when `play_id` is set (partial unique index). Reactions **`fire`** / **`shit`** added in migration **047** (default `fire` for backfilled rows).

```sql
-- Created in 007_competition_leaderboard_votes_spotlight_winners.sql; reaction added in 047.
CREATE TABLE leaderboard_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  play_id UUID REFERENCES plays(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reaction TEXT NOT NULL DEFAULT 'fire' CHECK (reaction IN ('fire', 'shit')),
  voter_cohort TEXT,                                -- 145: 'popular' | 'peer' (NULL for admins)
  counts_toward_score BOOLEAN NOT NULL DEFAULT TRUE -- 145
);

CREATE UNIQUE INDEX idx_leaderboard_likes_user_play
  ON leaderboard_likes(user_id, play_id) WHERE play_id IS NOT NULL;
CREATE INDEX idx_leaderboard_likes_song ON leaderboard_likes(song_id);
CREATE INDEX idx_leaderboard_likes_play_reaction ON leaderboard_likes(play_id, reaction);
```

- **`voter_cohort`:** `peer` when the voter holds a maker role (artist, service_provider, musician, dj); `popular` otherwise.
- **`counts_toward_score`:** false for admin votes, votes with no recorded listen, and bursts (8+ votes within 60 s). Such votes are kept but excluded from temperature.

### song_listener_ratings (143, 145)
Listener 1–10 score per song, stored apart from fire/poop votes.

```sql
CREATE TABLE song_listener_ratings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  voter_cohort TEXT,
  counts_toward_score BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, song_id)
);
```

### activity_flags (145, 146)
Integrity log for vote bursts, votes without a listen, and repeated comments (`reason`, optional `detail`). Reviewed from Admin; never bans automatically.

### song_temperature
Global, read-optimized cache of reaction totals and temperature per song (`song_id` is **`UUID`**, matching `songs.id`). Created in **048**; 50 baseline in **053**; cohort split and ratings in **145**.

```sql
CREATE TABLE song_temperature (
  song_id UUID PRIMARY KEY,
  fire_votes INTEGER NOT NULL DEFAULT 0,
  shit_votes INTEGER NOT NULL DEFAULT 0,
  total_votes INTEGER NOT NULL DEFAULT 0,
  decayed_fire_votes NUMERIC(14, 4) NOT NULL DEFAULT 0, -- plain fire count since 053
  decayed_shit_votes NUMERIC(14, 4) NOT NULL DEFAULT 0, -- plain poop count since 053
  temperature_percent INTEGER NOT NULL DEFAULT 50,
  popular_fire_votes INTEGER NOT NULL DEFAULT 0,
  popular_shit_votes INTEGER NOT NULL DEFAULT 0,
  popular_temperature_percent INTEGER NOT NULL DEFAULT 50,
  peer_fire_votes INTEGER NOT NULL DEFAULT 0,
  peer_shit_votes INTEGER NOT NULL DEFAULT 0,
  peer_temperature_percent INTEGER NOT NULL DEFAULT 50,
  popular_rating_avg NUMERIC,
  popular_rating_count INTEGER NOT NULL DEFAULT 0,
  peer_rating_avg NUMERIC,
  peer_rating_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_song_temperature_updated_at ON song_temperature(updated_at DESC);
```

- **Counts:** only `leaderboard_likes` rows with `counts_toward_score = true`.
- **`temperature_percent`:** `GREATEST(0, LEAST(100, 50 + fire - shit))`; `popular_` and `peer_` use the same formula per cohort.
- **Rating columns:** averages and counts from `song_listener_ratings` per cohort.
- **`refresh_song_temperature(p_song_id uuid)`:** recomputes and upserts the row for one song (the backend also calls it before reading).
- **Trigger `trg_refresh_song_temperature`:** `AFTER INSERT OR UPDATE OR DELETE ON leaderboard_likes` → `refresh_song_temperature` for affected `song_id` (and old `song_id` on update).

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
Payment records (Stripe on web; App Store and Google Play purchases are recorded too, see `payment_method`). Flows:

- **Credit bank (legacy):** `credits_purchased` set; on success, `increment_credits` RPC adds to artist balance.
- **Per-song placements:** `song_id` and `plays_purchased` (number of placements) set. Packs of 1, 3, 5, 10, 25, 50, or 100 placements; one placement is $1.99, larger packs are discounted and include bonus placements (`payments.service.ts`). Each placement adds 100 plays to `songs.credits_remaining`.
- **Purpose tag (057):** `purpose` routes Refinery and other checkouts in the webhook. Also `payment_method` (045). `stripe_charge_id` is unique (131).

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
  welcome_placements_remaining INTEGER, -- 127; 10 backfilled for makers (128, 132)
  welcome_bonus_granted_at TIMESTAMPTZ,  -- 127
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credits_artist_id ON credits(artist_id);
CREATE INDEX idx_credits_balance ON credits(balance) WHERE balance > 0;
```

Allocating the credit bank to songs is retired; welcome placements are applied to a song directly.

### rotation_queue
Database copy of each station's current song (`position = 0`). Redis holds the live queue state.

```sql
CREATE TABLE rotation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radio_id TEXT NOT NULL DEFAULT 'default',
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  priority_score DECIMAL NOT NULL,
  played_at TIMESTAMPTZ,
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rotation_queue_radio_id ON rotation_queue(radio_id);
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
Admin-curated fallback list per `radio_id`. Admin endpoints still manage it, but free rotation now draws from `songs` (`admin_free_rotation = true`) and does not read this table.

```sql
CREATE TABLE admin_fallback_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radio_id TEXT NOT NULL DEFAULT 'default',
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

CREATE INDEX idx_admin_fallback_songs_radio_id ON admin_fallback_songs(radio_id);
```

### radio_playlist_state
Persistent state for free rotation stack and playlist type. One row per radio via `radio_id`.

```sql
CREATE TABLE radio_playlist_state (
  id TEXT PRIMARY KEY,
  radio_id TEXT NOT NULL DEFAULT 'default' UNIQUE,
  playlist_type TEXT NOT NULL DEFAULT 'free_rotation',
  fallback_stack JSONB DEFAULT '[]'::jsonb,
  fallback_position INTEGER DEFAULT 0,
  stack_version_hash TEXT,
  songs_played_since_checkpoint INTEGER DEFAULT 0,
  last_switched_at TIMESTAMPTZ,
  last_checkpoint_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_radio_playlist_state_radio_id ON radio_playlist_state(radio_id);
```

**Per-radio playlists:** Each station has its own free and paid playlist state, keyed by station id (e.g. `us-ready-now-rap`; see `backend/src/radio/station.constants.ts`). The API accepts `?radio=<id>`; when omitted, or set to the legacy `default`/`global`, it resolves to `us-ready-now-rap`. The backend checkpoints the stack here every 5 songs.

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
Station Live Chat and per-song Comments (hot storage).

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  radio_id TEXT,  -- 050, station channel
  kind TEXT,      -- 144, 'live' | 'comment'
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
  opt_in_feed BOOLEAN,         -- 104, also show in the social feed
  feed_removed_at TIMESTAMPTZ, -- 104, moderation
  feed_removed_by UUID,        -- 104
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

Added to the `supabase_realtime` publication in **130**; public read policy in **129**.

## Other tables (by area)

Column lists are abbreviated; see the numbered migration for full definitions.

**Radio, listening, and votes**

| Table | Migration | Purpose / key columns |
|---|---|---|
| `radio_listener_presence` | 037 | Guest and signed-in presence: `stream_token`, `song_id`, last seen |
| `song_listen_events` | 139 | `song_id`, `stream_token`, `started_at`; unique-listener reach |
| `radio_ears_archive` | 080 | Archived "ears reached" counts |
| `listening_history` | 135 | Per-user recently played (`song_id`, title, artist, artwork, `played_at`) |
| `song_profile_listens` | 017 | Listens from artist profiles |
| `prospector_sessions`, `prospector_yield`, `prospector_check_ins`, `prospector_refinements`, `prospector_surveys` | 014 | Listening heartbeats and The Yield |
| `weekly_votes`, `weekly_winners`, `monthly_winners`, `yearly_winners`, `artist_spotlight`, `spotlight_listens`, `news_promotions` | 007 | Competition and spotlight |
| `daily_diamonds` | 020 | Daily diamond rewards |
| `dj_booth_sessions`, `dj_soundboard_clips` | 094 | DJ Booth sessions and soundboard |

**Songs and catalog**

| Table | Migration | Purpose / key columns |
|---|---|---|
| `song_featured_artists` | 044 | Featured artist credits |
| `song_favorites` | 111, 113 | Star / save, separate from `likes` |
| `artist_favorites` | 108 | Starred artists |
| `albums` | 123 | `artist_id`, `title`, `release_type` (single, ep, album, mixtape), `artwork_url`, `release_date` |
| `user_playlists`, `user_playlist_tracks` | 121 | Pro-Radio playlists (`title`, `is_public`; tracks with `position`) |
| `song_stories` | 137 | 24-hour clips on a song: `media_url`, `media_mime`, `caption` (≤ 280), `visibility` (public, private, hidden), `expires_at` |
| `song_purchases` | 071, 118 | Song/beat sales; `store`, `store_transaction_id` for App Store / Google Play |
| `refinery_reviews`, `refinery_custom_questions`, `reviewers`, `refinery_comments` | 015, 057 | The Refinery |
| `discover_song_likes`, `discover_swipes` | 035, 083 | Discover swipe deck |

**Subscriptions**

| Table | Migration | Purpose / key columns |
|---|---|---|
| `creator_network_subscriptions` | 045 | Creator Network plan |
| `pro_network_subscriptions` | 063, 109 | Pro-Networx messaging; Stripe plus store columns |
| `pro_radio_subscriptions` | 119 | Pro-Radio: `status`, `current_period_end`, Stripe ids, `store`, `apple_original_transaction_id`, `google_purchase_token`, `store_product_id`. `has_active_pro_radio_sub()` |

**Social, feed, and messaging**

| Table | Migration | Purpose / key columns |
|---|---|---|
| `user_follows` | 034 | Follows between any users |
| `discover_feed_posts` (+ `_comments`, `_likes`, `_bookmarks`, `_reports`) | 024, 062, 083, 096, 115 | Social feed; `audio_url` added in 115 |
| `service_messages`, `message_reactions`, `message_reads` | 008, 033 | Direct messages |
| `dm_conversation_accepts` | 124 | Message-request acceptance (`user_id`, `other_user_id`) |
| `user_blocks`, `user_reports` | 096 | Blocking and user reports |
| `content_reports` | 138 | Reports on stories, posts, comments, room/live chat, messages; `status` open, removed, dismissed |
| `artist_fans` | 136 | Artist email list (`artist_id`, `email`) |
| `artist_like_notification_settings` | 043 | Per-artist like notification prefs |

**Live and Pro-Networx**

| Table | Migration | Purpose / key columns |
|---|---|---|
| `artist_live_profiles`, `artist_live_sessions`, `artist_live_viewers`, `stream_donations`, `stream_ad_*` | 021 | Artist livestreams (Cloudflare Stream) |
| `stream_chat_messages` | 077, 112 | Livestream chat (`deleted_at` in 112) |
| `artist_live_services`, `live_broadcast`, `service_orders`, `service_requests` | 008 | Live services and requests |
| `studios` | 125, 126 | Studio listings: name, about, photos, amenities, address, `lat`/`lng`, `location_precision` (exact, approximate), contact, `booking_link`, `is_published`, `hours` |
| `studio_rates`, `studio_members` | 125, 126 | Rate cards (`price_cents`, `unit` hour, half_day, day, session) and team |

### `pro_networx` schema

Pro-Networx profile extensions keyed by `public.users.id` (016, 023, 061; exposed to PostgREST in 067):

- **`pro_networx.profiles`** — `user_id`, `available_for_work`, `skills_headline`, `current_title`, `about`, `website_url`, `experience`, `education`, `featured`, `resume_url`, `resume_filename`.
- **`pro_networx.skills`** and **`pro_networx.profile_skills`** — skill catalog and per-profile tags.
- **`pro_networx.handle_user_inserted()` / `seed_profile_from_user()`** — create a profile row for new users (064).

### Phone sign-in codes (146)

- **`phone_mfa_challenges`** — `user_id`, `phone_e164`, `code_hash`, `expires_at`, `attempts`, `consumed_at`.
- **`phone_mfa_sessions`** — `(user_id, auth_time)` marks a Firebase sign-in that passed the code. Both tables are closed to `anon` and `authenticated`.

## Functions and Triggers

### Notable RPCs

| Function | Migration | Purpose |
|---|---|---|
| `refresh_song_temperature(uuid)` | 048, 053, 145 | Recompute `song_temperature` (trigger on `leaderboard_likes`) |
| `get_song_recommendation_signals` | 139 | Approval, listen-time, and reach signals for rotation weighting |
| `get_unique_listener_count`, `get_daily_unique_listeners`, `get_ears_reached_for_songs_since` | 139 | Unique listener analytics |
| `get_radio_live_listeners` | 088 | Live listener count |
| `get_radio_ears_reached`, `get_song_ears_reached`, `get_artist_ears_reached`, `archive_*` | 079–085 | Ears reached and archiving |
| `get_artist_song_stats`, `get_artist_daily_stats`, `get_artist_daily_likes` | 058–060, 102 | The Wake analytics |
| `search_catalog(p_query, p_limit)` | 135 | Trigram search over songs and users |
| `has_active_pro_network_sub`, `has_active_pro_radio_sub` | 063, 119 | Subscription checks |
| `redeem_prospector_yield` | 018 | Yield redemption |
| `prune_automated_notifications`, `prune_play_decision_log` | 142, 147 | Housekeeping |
| `deduct_play_credits` | (project SQL, not in migrations) | Atomic per-play credit charge called by the radio service |

`allocate_credits_for_user`, `allocate_credits`, and `increment_credits` are revoked from `anon` and `authenticated` (129).

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

### song_lyrics (054 / 100 / 101)

Timed captions for radio / player UI. `plain_text` from the artist (or STT); `timed_lines` JSON from force alignment; `auto_generated` when transcribed without artist lyrics.

```sql
-- See backend/supabase/migrations/054_song_lyrics.sql,
-- 100_song_lyrics_alignment.sql, 101_song_lyrics_auto_generated.sql
```

### user_device_tokens & app_releases (105)

FCM registration tokens (`device_type` ios, android, web) and published app versions (`min_version`, `force_update`, optional broadcast push) for update prompts.

### users.city / users.zip_code (106)

Nearby People directory and map pins (coords remain on `artist_lat` / `artist_lng`).

### storage.buckets feed (107 → 116)

Discover feed media: **1GB** limit; image, video and audio MIME types (`video/mp4`, `video/webm`, `video/quicktime`, `audio/mpeg`, `audio/mp4`, …). Raised from 75MB → 200MB → 1GB so a few minutes of 4K phone video fits.

## Migration notes: leaderboard reactions & temperature (047 → 145)

| Migration | Purpose |
|-----------|---------|
| **047** | Adds `leaderboard_likes.reaction` (`fire` \| `shit`), backfill, `CHECK`, index on `(play_id, reaction)`. |
| **048** | Introduces `song_temperature`, `refresh_song_temperature(uuid)`, trigger on `leaderboard_likes`, backfill from existing votes. Initial `temperature_percent` used a ratio-style default when no votes. |
| **049** | Adds `decayed_fire_votes` / `decayed_shit_votes`, sets default `temperature_percent` to **0**, replaces `refresh_song_temperature` with **time-decay** aggregation, backfills all songs with votes. |
| **053** | Sets a **50** baseline (+1 per fire, −1 per poop, clamped 0–100), removes decay, and resets cached rows. |
| **145** | Adds `voter_cohort` / `counts_toward_score` to `leaderboard_likes` and `song_listener_ratings`, `popular_*` / `peer_*` columns to `song_temperature`, and `activity_flags`. `refresh_song_temperature` keeps the 053 formula but counts only votes with `counts_toward_score`. |

Apply in numeric order with other Supabase migrations under `backend/supabase/migrations/`.

## Row Level Security (RLS)

Migration **129** enables RLS on every `public` table that was reachable through PostgREST (subscriptions, donations, orders, chat, moderation, votes, and more) and revokes the credit allocation RPCs from client roles. The backend uses the service role, which bypasses RLS, so this does not change the API. Clients reach Supabase directly only for:

- **Realtime:** `postgres_changes` on `station_events` (public read policy), `likes`, and `service_messages`, plus broadcast channels (`dj-booth:{stationId}`, `radio-chat:{stationId}`).
- **Storage:** signed upload URLs issued by the backend.

New tables (e.g. `song_listener_ratings`, `activity_flags`, `phone_mfa_*`) enable RLS with no client policies.
