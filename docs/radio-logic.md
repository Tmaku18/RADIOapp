# Radio Logic

This document describes how the backend chooses and orders tracks for the radio stream: playlist type (free vs paid), tier selection, and **artist spacing** so the same artist’s songs are not played back-to-back.

**Implementation:** `backend/src/radio/radio.service.ts` (and Redis state in `radio-state.service.ts`).

---

## When free vs paid mode

- **Paid mode** is used when listener count is **at or above** `THRESHOLD_ENTER_PAID` (default 5).
- **Free mode** is used when listener count drops **below** `THRESHOLD_EXIT_PAID` (default 3).
- Hysteresis between these thresholds prevents rapid switching when count hovers near the boundary.

---

## Four-tier selection (paid mode)

When in paid mode, the next track is chosen in this order:

1. **Credited songs** – `status = approved`, `credits_remaining > 0`, and enough credits for the full play duration (1 credit per 5 seconds).
2. **Trial songs** – `status = approved`, `trial_plays_remaining > 0`, `credits_remaining <= 0`.
3. **Opt-in songs** – `status = approved`, `opt_in_free_play = true`, trial and credits exhausted.
4. **Free rotation (fallback)** – Admin fallback + opt-in/admin-free-rotation songs from a **stack** (see below).

Within each tier, one song is chosen via **soft-weighted random** (see below). If a tier has no eligible songs, the next tier is used.

---

## Artist spacing

We avoid playing the same artist’s songs back-to-back in two ways.

### 1. Paid / trial / opt-in (weighted random)

- Before choosing from credited, trial, or opt-in pools, we resolve the **current** track’s stack ID (`song:uuid` or `admin:uuid`) to an **artist ID** (`getArtistIdForStackId`). Admin tracks have no artist; we pass `null` and do not filter.
- When picking the next song, we pass this **last-played artist ID** into `selectWeightedRandom`.
- Any song with the same `artist_id` as the last-played artist gets **weight 0** (never selected) when there are other options.
- If every candidate is the same artist, we ignore the filter and still pick one song so the stream never stalls.

So: we **deprioritize** (exclude when possible) the artist that just played; we do not change the four-tier order.

### 2. Free rotation (stack refill)

- Free rotation uses a **stack** of stack IDs (`song:uuid`, `admin:uuid`) stored in Redis. We pop from the stack for each play.
- When the stack is **empty**, we refill it from:
  - **Admin fallback songs** (`admin_fallback_songs`, `is_active = true`)
  - **Songs** with `status = approved`, `admin_free_rotation = true`, `opt_in_free_play = true`
- Each item has an **artist ID**: songs use `artist_id`; admin entries use a unique id per row (e.g. `admin:<id>`) so they don’t cluster.
- Refill order is built by **shuffle-with-artist-spacing** (`shuffleWithArtistSpacing`):
  - Group items by `artistId`.
  - Shuffle the list of artists and shuffle within each artist’s list (so track order per artist isn’t fixed).
  - Build one ordered list by **round-robin**: take one from each artist in turn until all are used (e.g. A1, B1, C1, A2, B2, …).

So in free rotation, an artist’s 5 songs are **spaced out** across the refilled stack instead of playing in a row.

---

## Soft-weighted random (paid/trial/opt-in)

Used when selecting one song from a tier (credited, trial, or opt-in):

- **Base weight** 1.0 for every song.
- **+0.1** if the song has above-average `credits_remaining` (rewards investment).
- **+0.1** if the song was not played in the last hour (reduces repetition).
- **Weight = 0** for the **current** song (no immediate repeat).
- **Weight = 0** for any song whose `artist_id` equals **last-played artist** (artist spacing; see above).
- If total weight is 0 (e.g. all same artist), we fall back to picking any song so playback continues.

One song is then chosen at random with probability proportional to these weights (max weight 1.2).

---

## State and persistence

- **Redis** (when `REDIS_URL` is set): current track, position, free-rotation stack, listener count, playlist type. Enables horizontal scaling.
- **Supabase**: song metadata, credits, trial plays, opt-in flags, admin fallback list. Checkpoints of free-rotation stack can be written for audit (e.g. `stack_version_hash`).
- **Play decision log**: `play_decision_log` table records which tier and reason were used for each play (algorithm transparency).

---

## Realtime station events (listen surface)

In addition to selection logic, the backend emits station-wide realtime events through Supabase Realtime:

- **Rising Star**: When a song’s conversion during its current play reaches the threshold (default 5%), a `station_events` row is inserted with `type = 'rising_star'`. Web/mobile clients subscribe to `postgres_changes` to show a temporary “Butterfly Ripple” banner.

These events do not change tier selection; they are purely UI signals.

---

## Summary table

| Context              | How we avoid same-artist back-to-back                          |
|----------------------|-----------------------------------------------------------------|
| Free rotation refill | Round-robin by artist when building the stack (artist spacing).  |
| Credited / trial / opt-in | Weight 0 for last-played artist in weighted random; fallback if all same artist. |

See also: root **README.md** (Radio Streaming features), **backend/README.md** (Radio System), and **docs/api-spec.md** (Radio endpoints).
