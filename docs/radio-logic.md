# Radio Logic

This document describes how the backend runs each radio station: station ids, playlist type (free vs paid), tier selection, free rotation, **artist spacing**, temperature votes, listener presence, and how the web and mobile players stay in sync.

**Implementation:** `backend/src/radio/radio.service.ts`, Redis state in `radio-state.service.ts`, station ids in `station.constants.ts`, realtime broadcasts in `station-realtime.service.ts`. Endpoints are listed in [api-spec.md](api-spec.md#radio).

---

## Stations

- Station ids live in `backend/src/radio/station.constants.ts` (30 stations, e.g. `us-ready-now-rap`, `us-rap`, `us-rap-clean`, `us-gospel`, `us-kids-friendly`, `us-rideshare`, `us-testing-grounds`). Display names are in `STATION_DISPLAY_NAMES`; `STATION_IDS_BY_GENRE` maps a listener's favorite genres to stations.
- The default station is **`us-ready-now-rap`** (Ready Now Radio). `normalizeSongStationId` maps blank, `global`, `default`, legacy `ga-*` ids, and unknown ids to a current id (`us-christian` becomes `us-gospel`).
- A song belongs to a station through `songs.station_id` or the `songs.station_ids` array.
- `us-rap-clean`, `us-kids-friendly`, and `us-rideshare` only play songs with `is_explicit = false`.
- Only songs whose audio URL ends in a web-playable extension (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.mp4`, `.aac`, `.webm`) are selected.

---

## When free vs paid mode

- **Paid mode** is used when listener count is **at or above** `THRESHOLD_ENTER_PAID` (5).
- **Free mode** returns when listener count is **at or below** `THRESHOLD_EXIT_PAID` (3).
- Hysteresis between these thresholds prevents rapid switching when count hovers near the boundary.
- `us-rap`, `us-rap-clean`, `us-ready-now-rap`, `us-kids-friendly`, `us-testing-grounds`, and `us-rideshare` always run free rotation.
- The count read here is the Redis `radio:{id}:listeners` counter. The app no longer increments it (live listening is measured by presence, below), so stations currently stay in free rotation.

---

## Four-tier selection (paid mode)

When in paid mode, the next track is chosen in this order (all tiers require `status = approved`, `is_public = true`, and station scope):

1. **Credited songs** – `credits_remaining > 0`. One credit pays for one play, charged atomically by the `deduct_play_credits` RPC.
2. **Trial songs** – `trial_plays_remaining > 0`, `credits_remaining <= 0`.
3. **Opt-in songs** – `admin_free_rotation = true`, trial plays and credits exhausted.
4. **Free rotation (fallback)** – the station's free-rotation stack (see below).

Within each tier, one song is chosen via **soft-weighted random** (see below). If a tier has no eligible songs, the next tier is used.

Credits reach a song as **placements**: bought per song (Stripe on web, App Store / Google Play in the app) or applied from the signup welcome placements. The old allocate/withdraw endpoints return 400.

---

## Free rotation

- **Pool:** `songs` with `status = approved`, `is_public = true`, `admin_free_rotation = true`, in the station's scope (and clean-only on filtered stations). The pool is cached per station and cleared when an admin changes it.
- **Admin approval** sets `admin_free_rotation = true` and `is_public = true`, then queues the song **next** (position 0) on each of its stations. Pending and rejected songs are removed from rotation. With `BETA_AUTO_FREE_ROTATION`, uploads are approved automatically.
- **Stack:** an ordered list of stack ids (`song:<uuid>`) in Redis (`radio:{id}:free_rotation_stack`). Each play pops the next id.
- **No repeats per cycle:** played ids go into `radio:{id}:free_rotation_played`. When the stack drains, a new cycle starts with a fresh shuffle.
- **Reconcile:** `reconcileFreeRotationStack` drops songs that are no longer eligible and appends newly eligible ones without reshuffling the rest.
- If the next id would replay the current song, it is swapped with another candidate.
- Admins can edit the stack directly (`/admin/radios/:id/queue`, Free Rotation and Queue pages). The `admin_fallback_songs` table still has admin endpoints but rotation no longer reads it.

---

## Artist spacing

We avoid playing the same artist's songs back-to-back in two ways.

### 1. Paid / trial / opt-in (weighted random)

- Before choosing from credited, trial, or opt-in pools, we resolve the **current** track's stack id to an **artist id** (`getArtistIdForStackId`).
- That **last-played artist id** is passed into `selectWeightedRandom`; any song by the same artist gets **weight 0** when there are other options.
- If every candidate is the same artist, we ignore the filter and still pick one song so the stream never stalls.

### 2. Free rotation (stack refill)

- The stack is built by **shuffle-with-artist-spacing** (`shuffleWithArtistSpacing`):
  - Group items by `artistId`.
  - Shuffle the list of artists and shuffle within each artist's list.
  - Build one ordered list by **round-robin**: one from each artist in turn (A1, B1, C1, A2, B2, …).

So in free rotation, an artist's 5 songs are **spaced out** across the stack instead of playing in a row.

---

## Soft-weighted random (paid/trial/opt-in)

Used when selecting one song from a tier:

- **Base weight** 1.0 for every song.
- **Listener-quality nudge** from the `get_song_recommendation_signals` RPC (cached 60 s): approval rate × 0.15, a listen-time nudge of ±0.1, and reach up to +0.15 (`log10(1 + ears) × 0.05`).
- **+0.1** if the song has above-average `credits_remaining`.
- **+0.1** if the song was not played in the last hour.
- **Weight = 0** for the **current** song and for the **last-played artist**.
- If total weight is 0, the first candidate plays so playback continues.

One song is then chosen at random with probability proportional to these weights.

---

## Advancing a station

- **Server clock:** each station has its own timer that advances at the song boundary (+250 ms). A safety sweep runs every `RADIO_BACKGROUND_POLL_MS` (default 45 s) over the default stations, stations with saved playlist state, and stations that have free-rotation songs. Empty stations are rechecked every 10 minutes.
- **One advance at a time:** an in-process lock plus a Redis lock (`radio:{id}:advance_lock`, 20 s) serialize advances.
- **Client force requests:** `GET /radio/next?force=1&after=<songId>` only advances when the station is still on `after` and less than 15 s remain. A force without `after` is ignored within 8 s of the last advance.
- **Broadcast:** after an advance the server sends `queue_updated` (with `crossfadeMs: 3000`) on `dj-booth:{stationId}` about 8 s later so clients can refetch.
- **Empty station:** the response is `degraded` (the last good song from Redis, kept 24 h, or `RADIO_JINGLE_URL`) or `no_content`.
- **Transport:** the DJ Booth can pause, resume, and skip back; transport state is stored in Redis and broadcast on the station channel.

---

## Metering and play decisions

- A station is **metered** when presence or heartbeat shows someone on the current song (`stationHasLiveListeners`).
- When nobody is listening, the station still advances on schedule but does **not** deduct credits or trial plays, write `plays`, write `play_decision_log`, or send notifications. When the first listener arrives mid-song, `noteLiveListener` backfills the `plays` row.
- **`play_decision_log`** records `selection_reason` (`credits`, `trial`, `opt_in`, `fallback`), tier, listener count, competing songs, and weight score for transparency. `prune_play_decision_log` trims old rows.
- **Notifications:** the artist gets a "Live Now" push when a song starts, followers get an on-air alert, and up-next alerts are scheduled about 5 minutes and 1 minute before a song plays.
- **Trial by Fire** windows are configured with `TRIAL_BY_FIRE_START_UTC` (`HH:MM`) and `TRIAL_BY_FIRE_DURATION_MIN`; it is off when unset.

---

## Votes and temperature

- **Fire / poop votes:** `POST /leaderboard/songs/:id/like` with `{ playId, reaction: 'fire' | 'shit' }`. One vote per listener per play. Sending the same reaction again removes it; sending the other one switches it. Fire also adds the song to Liked (`likes`). The star (`song_favorites`) is separate.
- **Vote integrity** (`common/vote-integrity.ts`): each vote is stamped with `voter_cohort` (`peer` for artists, Catalysts, musicians, and DJs; `popular` for everyone else) and `counts_toward_score`. Votes do not count when cast by admins, without any recorded listen, or in bursts of 8+ votes within 60 s. Suspicious patterns are logged to `activity_flags` (at most one per reason per hour); accounts are never banned automatically.
- **Temperature** (`refresh_song_temperature`, migration 145): `temperature_percent = clamp(50 + fire − poop, 0, 100)` over counting votes, plus separate `popular_` and `peer_` temperatures. Every song starts at 50.
- **Ratings:** `POST /songs/:id/rating` stores a 1–10 score in `song_listener_ratings` (also cohort-stamped). Averages appear as `popular_rating_avg` and `peer_rating_avg`. Ratings do not change temperature.
- `/radio/current` refreshes and caches temperature for 60 s; a vote clears that cache so the next read is current.

---

## Presence and listener counts

- **`POST /radio/heartbeat`** (signed-in) records listening in `prospector_sessions` for The Yield.
- **`POST /radio/presence`** (guests and signed-in, 30/min) upserts `radio_listener_presence` by stream token and song, and records `song_listen_events` for unique-listener reach.
- **Live listener count** = distinct signed-in users plus anonymous stream tokens seen within `LISTENER_HEARTBEAT_ACTIVE_WINDOW_SECONDS` (default 120 s), cached 30 s.

---

## Clients

**Web** (`web/src/components/radio/`, `web/src/lib/radio-sync.ts`):

- Starts on the last station the listener chose, or `us-ready-now-rap`.
- `RadioBackgroundSync` polls `/radio/current` every 20 s (60 s when the tab is hidden), resyncs on focus, and refetches on `queue_updated`.
- At song end, `resolveNextTrackAfterEnd` calls `/radio/next`, then `/radio/next?force=true&after=<ended>` if the server still returns the old song. Clients hand off within the last 15 s of a song.
- The player sends presence every 30 s and heartbeats when signed in.

**Mobile** (`mobile/lib/core/services/`):

- `RadioBackgroundSyncService` reopens the last station saved on the device and polls `/radio/current` (20 s, 45 s in the background).
- `RadioPresenceService` sends presence every 60 s; `radio_service.dart` calls `current`, `next`, `peek`, `queue`, `heartbeat`, `presence`, and the vote endpoint.
- Votes are also available from the lock screen and Dynamic Island.

---

## State and persistence

- **Redis** (`REDIS_URL`): per-station keys under `radio:{id}:` — current song, play id, start time, playlist type, free-rotation stack and played set, transport, booth state, recent history (20), last advance, advance lock, last good song.
- **Supabase**: song metadata, credits, trial plays, rotation flags, the current song in `rotation_queue` (position 0), and `radio_playlist_state` checkpoints (every 5 songs).
- **Signed audio URLs** for Supabase storage are valid 1 h and cached 50 min.

---

## Realtime station events (listen surface)

- **Station channel** `dj-booth:{stationId}` (Supabase broadcast, event `dj_booth_event`): `queue_updated`, `transport_pause`, `transport_play`, `mic_on`, `mic_off`, `duck_volume`, `soundboard_play`.
- **Rising Star**: when votes during a play reach 5% of listeners at play start, a `station_events` row is inserted with `type = 'rising_star'`. Web and mobile subscribe to `postgres_changes` to show the "Butterfly Ripple" banner.

These events do not change tier selection; they drive the player UI.

---

## Summary table

| Context              | How we avoid same-artist back-to-back                          |
|----------------------|-----------------------------------------------------------------|
| Free rotation stack  | Round-robin by artist when building the stack (artist spacing).  |
| Credited / trial / opt-in | Weight 0 for last-played artist in weighted random; fallback if all same artist. |

See also: root **README.md** (Radio Streaming features), **backend/README.md** (Radio System), and **docs/api-spec.md** (Radio endpoints).
