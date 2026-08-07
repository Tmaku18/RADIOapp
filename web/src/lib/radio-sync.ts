/**
 * Shared helpers for keeping web radio playback aligned with the server without
 * cutting songs short when the server clock runs ahead of the local decoder.
 */

/** True when local playback is within [thresholdSeconds] of the track end. */
export function isNearRadioTrackEnd(
  currentTime: number,
  duration: number,
  fallbackDurationSeconds?: number,
  thresholdSeconds = 8,
): boolean {
  const total =
    duration > 0 ? duration : (fallbackDurationSeconds ?? 0);
  if (total <= 0) return true;
  return currentTime >= total - thresholdSeconds;
}

/** Payload shape from GET /radio/current and /radio/next. */
export type RadioTrackApiPayload = {
  id?: string;
  title?: string;
  artist_name?: string;
  artist_origin_city?: string | null;
  artist_origin_state?: string | null;
  artist_id?: string | null;
  artwork_url?: string | null;
  audio_url?: string;
  duration_seconds?: number;
  position_seconds?: number;
  play_id?: string | null;
  listener_count?: number;
  fire_votes?: number;
  shit_votes?: number;
  temperature_percent?: number;
  no_content?: boolean;
  message?: string;
  is_live?: boolean;
  artist_live_now?: {
    sessionId: string;
    status: 'starting' | 'live';
    currentViewers?: number;
  } | null;
  pinned_catalysts?: unknown[];
  transport_paused?: boolean;
  dj_overlay?: unknown;
  stale?: boolean;
};

/**
 * Resolve the next track after local playback ends. Handles server clock lag
 * (same ID as ended) and stale responses after client-side prefetch.
 */
export async function resolveNextTrackAfterEnd(args: {
  radioId: string;
  endedTrackId: string | null;
  isStaleRadioServerTrack: (trackId: string | null | undefined) => boolean;
  getNextTrack: (params: {
    radio: string;
    force?: boolean;
    after?: string;
  }) => Promise<{ data: RadioTrackApiPayload }>;
}): Promise<RadioTrackApiPayload | null> {
  const firstResp = await args.getNextTrack({ radio: args.radioId });
  let trackData = firstResp.data;

  const returnedId =
    trackData?.id && typeof trackData.id === 'string' ? trackData.id : null;

  const needsForce =
    (!!returnedId &&
      !!args.endedTrackId &&
      returnedId === args.endedTrackId) ||
    (!!returnedId && args.isStaleRadioServerTrack(returnedId));

  if (needsForce) {
    // Send the song we finished so the server ignores this nudge if another
    // listener already moved the queue on — otherwise we'd skip a track for
    // everyone tuned in.
    const forcedResp = await args.getNextTrack({
      radio: args.radioId,
      force: true,
      ...(args.endedTrackId ? { after: args.endedTrackId } : {}),
    });
    trackData = forcedResp.data ?? trackData;
  }

  const finalId =
    trackData?.id && typeof trackData.id === 'string' ? trackData.id : null;
  if (finalId && args.isStaleRadioServerTrack(finalId)) {
    return null;
  }
  // Same song we just finished. Usually that means the server clock lags and
  // reloading would audibly repeat the outro — but on a station with a single
  // track it's a genuine repeat, and the server restarting it from the top is
  // how we tell the two apart.
  if (finalId && args.endedTrackId && finalId === args.endedTrackId) {
    if (!isFreshlyStartedRadioTrack(trackData)) return null;
  }

  return trackData ?? null;
}

/** True when a payload describes a song the server has just (re)started. */
export function isFreshlyStartedRadioTrack(
  payload: RadioTrackApiPayload | null | undefined,
): boolean {
  if (!payload) return false;
  const position = Number(payload.position_seconds);
  return Number.isFinite(position) && position <= RESTART_POSITION_TOLERANCE;
}

/** How far into a song still counts as "just started". */
const RESTART_POSITION_TOLERANCE = 5;

/** Pick a resume offset that never jumps backward (avoids background tab repeats). */
export function resolveRadioResumePosition(args: {
  localCurrentTime: number;
  serverPosition: number;
}): number | null {
  const local =
    Number.isFinite(args.localCurrentTime) && args.localCurrentTime > 0
      ? args.localCurrentTime
      : 0;
  const server = args.serverPosition > 0 ? args.serverPosition : 0;
  const merged = Math.max(local, server);
  if (merged <= 1) return null;
  return merged;
}

/**
 * How close to the end of the local song we hand off to the `ended` handler
 * instead of hard-switching. Listeners run a few seconds behind the server
 * clock (response fetch + buffer fill), so at every rotation the server
 * announces the next song while the local outro is still playing. Cutting it
 * off is what users report as "falling out of sync" — the ended handler is
 * about to make the same transition cleanly via `/next?after=`, which always
 * lands on the server's current song.
 *
 * Beyond this window the client is genuinely parked (resumed from sleep,
 * long stall, DJ skipped mid-song) and a hard switch is the right call.
 */
export const RADIO_BOUNDARY_HANDOFF_SECONDS = 15;

/**
 * The server queue moved on while the local song is still finishing.
 *
 * Only defers while playback is actively progressing: a paused element never
 * fires `ended`, so deferring for it would park the listener on a dead song
 * while the station plays on.
 */
export function isServerAheadMidSong(args: {
  trackIdentityChanged: boolean;
  isPlaying: boolean;
  pausedAt: number | null;
  currentTime: number;
  duration: number;
  fallbackDurationSeconds?: number;
}): boolean {
  if (!args.trackIdentityChanged) return false;
  if (!args.isPlaying || args.pausedAt != null) return false;
  const duration =
    args.duration > 0 ? args.duration : (args.fallbackDurationSeconds ?? 0);
  if (duration <= 0) return false;
  if (args.currentTime <= 0) return false;
  const remaining = duration - args.currentTime;
  return remaining > 0 && remaining <= RADIO_BOUNDARY_HANDOFF_SECONDS;
}

/**
 * Whether to ignore a server track switch and stay on the local song.
 * Background tabs throttle timeupdate, so React state.currentTime is often stale
 * and would incorrectly block advances after a track ends on mobile.
 */
export function shouldDeferServerTrackSwitch(args: {
  documentHidden?: boolean;
  afterLocalTrackEnded?: boolean;
  trackIdentityChanged: boolean;
  isPlaying: boolean;
  pausedAt: number | null;
  currentTime: number;
  duration: number;
  fallbackDurationSeconds?: number;
}): boolean {
  if (args.documentHidden || args.afterLocalTrackEnded) return false;
  return isServerAheadMidSong(args);
}
