# Future Changes To-Do List (Revised)

This plan integrates stability, trust, and UX insights into a phased roadmap.

---

## Critical Architectural Changes

### NEW: Redis State Management (Priority: Critical)

**Problem:** In-memory state (Queue, Emojis, Prime Time) breaks on server restart or scaling.

**Solution:** Move all radio state to Redis. Treat NestJS as stateless.

```typescript
interface RadioState {
  currentSong: { id: string; startedAt: number; durationMs: number };
  nextQueue: string[];  // Song IDs
  listenerCount: number;
  primeTimeActive: boolean;
}
```

### NEW: Algorithm Transparency Log (Priority: High)

**Problem:** Artists will accuse platform of bias without proof of fair selection.

**Solution:** Create `play_decision_log` table to record why each song was selected.

```sql
CREATE TABLE play_decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id),
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  selection_reason TEXT,  -- 'trial', 'credits', 'free_rotation', 'fallback'
  tier_at_selection TEXT,
  listener_count INTEGER,
  weight_score DECIMAL,
  random_seed TEXT,
  competing_songs INTEGER  -- How many songs were eligible
);
```

### NEW: Server-Side Duration Validation (Priority: High)

**Problem:** Artists could upload 10-min song tagged as 3-min to pay less credits.

**Solution:** Use ffmpeg/ffprobe on upload to verify actual duration.

```typescript
// In uploads.service.ts
import * as ffprobe from 'fluent-ffmpeg';

async validateDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffprobe.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      resolve(Math.ceil(metadata.format.duration));
    });
  });
}
// ALWAYS overwrite user-provided duration with server-validated value
```

---

## Revised Item List

### Item 1: Admin Song Status Transitions

Allow admins to move songs between **pending**, **approved**, and **rejected** states from any current state.

**Added:** Audit columns for accountability:
- `status_changed_by` UUID
- `status_changed_at` TIMESTAMPTZ
- `status_change_reason` TEXT

### Item 2: Live Chat Real-Time Updates

Fix chat messages not appearing until page reload - backend needs to subscribe to Realtime channel before broadcasting.

**No changes from original plan.**

### Item 3: Notification Bell Button Styling

Add background/outline to the notification bell icon in the web dashboard to make it look like a clickable button.

**No changes from original plan.**

### Item 4: Clear Notifications

Add the ability to delete/clear notifications - both individual notifications and all at once.

**Changed:** Use soft deletes instead of hard deletes for audit trail.

```sql
ALTER TABLE notifications ADD COLUMN deleted_at TIMESTAMPTZ;
-- Query: WHERE deleted_at IS NULL
```

### Item 5: Admin Free Rotation Search + Trial Rotation

Replace manual entry for fallback songs with a search interface.

**ADDED: Trial Rotation System**

New approved songs get 1-3 free "Trial Plays" before requiring credits. This:
- Gives new artists exposure to get hooked
- Provides data for the play_decision_log
- Prevents pay-to-enter monopoly

```typescript
interface SongCredits {
  credits_remaining: number;
  trial_plays_remaining: number;  // NEW: Starts at 3
  trial_plays_used: number;       // NEW: Tracks usage
}

// Selection logic:
// If trial_plays_remaining > 0, song is eligible even with 0 credits
// After play, decrement trial_plays_remaining
```

### Item 6: Admin Ban System (Hard Ban + Shadow Ban)

**REVISED:** Two-tier ban system:

| Type | Use Case | Behavior |
|------|----------|----------|
| **Shadow Ban** | Chat trolls | User thinks they're chatting; no one sees messages |
| **Hard Ban** | ToS violators | Full account lockout + token revocation |

**Hard Ban Implementation:**

```typescript
async hardBanUser(userId: string, adminId: string, reason: string) {
  // 1. Set ban flags in DB
  await supabase.from('users').update({
    is_banned: true,
    banned_at: new Date().toISOString(),
    ban_reason: reason,
    banned_by: adminId,
  }).eq('id', userId);
  
  // 2. Get Firebase UID
  const { data: user } = await supabase
    .from('users')
    .select('firebase_uid')
    .eq('id', userId)
    .single();
  
  // 3. Revoke all refresh tokens (forces logout everywhere)
  await admin.auth().revokeRefreshTokens(user.firebase_uid);
  
  // 4. Invalidate FCM tokens (stop push notifications)
  await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId);
}
```

### Item 7: Analytics Implementation (Iterative)

**No major changes.** Add composite indexes for scale:

```sql
CREATE INDEX idx_song_plays_composite ON song_plays(song_id, played_at);
CREATE INDEX idx_plays_artist ON plays(song_id, played_at);
```

Use raw SQL for reporting queries instead of ORM filtering.

### Item 8: True Radio Sync with Soft Pause (REVISED)

**CHANGED:** "Soft Pause" instead of removing pause entirely.

**Original Plan:** Remove pause completely (rage quit risk).

**Revised Plan:** DVR-style 30-second buffer.

| Pause Duration | Behavior |
|----------------|----------|
| < 30 seconds | Resume from buffer (seamless) |
| > 30 seconds | Show "Jump to Live" button |

```typescript
// Client-side buffer management
const BUFFER_DURATION_MS = 30000;
let pausedAt: number | null = null;

function handlePause() {
  pausedAt = Date.now();
  audioRef.current.pause();
}

function handleResume() {
  const pauseDuration = Date.now() - pausedAt;
  
  if (pauseDuration < BUFFER_DURATION_MS) {
    // Resume from buffer
    audioRef.current.play();
  } else {
    // Too long - must sync to live
    showJumpToLiveUI();
  }
}

function jumpToLive() {
  const response = await radioApi.getCurrentTrack();
  audioRef.current.currentTime = response.data.position_seconds;
  audioRef.current.play();
}
```

**Mobile:** Use background audio buffer (more complex but same concept).

### Item 9: Continuous Playback and Error Handling

**Added:** Deterministic shuffle for reproducibility.

```typescript
// Use seeded random for shuffle (reproducible for debugging)
function seededShuffle<T>(array: T[], seed: string): T[] {
  const rng = seedrandom(seed);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Log the seed to play_decision_log for audit
```

### Item 10: Listener-Based Tier System (DEFERRED)

**STATUS:** Do NOT build until >1,000 daily listeners.

The complexity/benefit ratio is too high for early stage. Focus on Items 1-9, 11-12 first.

### Item 11: BUG FIX - Profile Display Name

**Solution:** Use Shared DTOs for consistent snake_case to camelCase transformation.

```typescript
// shared/dto/user-response.dto.ts
export class UserResponseDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  
  static fromDb(data: any): UserResponseDto {
    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      role: data.role,
      createdAt: data.created_at,
    };
  }
}
```

### NEW Item 12: Up-Next Notifications (Debounced)

Notify artists 60 seconds before their song plays.

**Debounce:** Max 1 push notification per artist per 4 hours.

```typescript
async notifyArtistUpNext(artistId: string, songTitle: string) {
  // Check last notification time
  const lastNotif = await getLastNotificationTime(artistId, 'up_next');
  const hoursSince = (Date.now() - lastNotif) / (1000 * 60 * 60);
  
  if (hoursSince < 4) {
    return; // Debounced
  }
  
  await sendPushNotification(artistId, {
    title: 'Your song is up next!',
    body: `"${songTitle}" will play in about 1 minute`,
  });
}
```

---

## Revised Summary Table

| # | Description | Type | Phase | Priority |
|---|-------------|------|-------|----------|
| - | Redis State Management | Architecture | 1 | Critical |
| - | Algorithm Transparency Log | Trust | 1 | Critical |
| - | Server-Side Duration Validation | Security | 1 | High |
| 11 | Profile Display Name Bug | Bug Fix | 1 | High |
| 6 | Hard Ban + Token Revocation | Security | 1 | High |
| 2 | Live Chat Real-Time Updates | Bug Fix | 1 | Medium |
| 8 | True Radio Sync + Soft Pause | Feature | 2 | High |
| 12 | Up-Next Notifications (Debounced) | Feature | 2 | Medium |
| 5 | Free Rotation + Trial Plays | Feature | 2 | Medium |
| 7a | Artist Analytics | Feature | 2 | Medium |
| 1 | Admin Song Status Transitions | Feature | 2 | Low |
| 3 | Notification Bell Styling | UI | 2 | Low |
| 4 | Clear Notifications (Soft Delete) | Feature | 3 | Low |
| 9 | Continuous Playback | Feature | 3 | Medium |
| 7b-c | Homepage/Admin Analytics | Feature | 3 | Low |
| 10 | Tier System | Feature | **Defer** | Future |

---

## Phased Roadmap

### Phase 1: "Iron Clad" Foundation (Weeks 1-3)

**Goal:** Stability, Security, Trust

- [ ] Move Queue/Radio State to Redis
- [ ] Implement `play_decision_log` table
- [ ] Implement `credit_allocations` RPC for atomic transactions
- [ ] Add server-side duration validation (ffprobe)
- [ ] Fix profile bug (Item 11) with Shared DTOs
- [ ] Implement Hard Ban with token revocation (Item 6)
- [ ] Fix Live Chat broadcasting (Item 2)

### Phase 2: "Human" Experience (Weeks 4-6)

**Goal:** UX, Engagement, Fairness

- [ ] Implement "Soft Pause" buffer (Item 8)
- [ ] Add "Up Next" notifications with debounce (Item 12)
- [ ] Implement Trial Rotation for new songs (Item 5)
- [ ] Build Artist Dashboard analytics (Item 7a)
- [ ] Admin song status transitions (Item 1)
- [ ] Notification bell styling (Item 3)

### Phase 3: "Business" Layer (Weeks 7+)

**Goal:** Optimization, Cleanup

- [ ] Continuous playback with deterministic shuffle (Item 9)
- [ ] Soft delete notifications (Item 4)
- [ ] Homepage/Admin analytics (Item 7b-c)

### Phase 4: Scale (When >1k daily listeners)

- [ ] Tier System (Item 10)

---

## End-to-End Test Scenario: "Fair Play"

1. **Upload:** Artist uploads song. Server validates duration via ffprobe (prevents spoof). Artist receives 3 "Trial Plays".

2. **Selection:** Radio Engine (Redis-backed) picks song based on Trial weight. Logs to `play_decision_log`: "Selected via Trial Logic, Weight: 1.2, Competing: 15".

3. **Sync:** Listener A (Web) and Listener B (Mobile) connect. Both auto-seek to 0:45. Listener B pauses for 10s, resumes seamlessly (buffer works).

4. **Reaction:** Listener A sends "🔥". Redis aggregates. Listener B sees "🔥 x1" after 2s (no event storm).

5. **Ban:** Listener C spams slurs. Admin Shadow Bans C. C keeps typing, sees own messages. A and B see nothing. If C escalates, admin Hard Bans → all tokens revoked, logged out everywhere.

6. **Completion:** Song ends. Trial play used (no credits deducted). `trial_plays_remaining` decremented.

7. **Audit:** Admin checks:
   - `play_decision_log`: "Selected via Trial Logic"
   - `credit_allocations`: "0 deducted (Trial)"
   - Trust maintained.
