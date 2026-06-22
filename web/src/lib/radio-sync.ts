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
    const forcedResp = await args.getNextTrack({
      radio: args.radioId,
      force: true,
    });
    trackData = forcedResp.data ?? trackData;
  }

  const finalId =
    trackData?.id && typeof trackData.id === 'string' ? trackData.id : null;
  if (finalId && args.isStaleRadioServerTrack(finalId)) {
    return null;
  }

  return trackData ?? null;
}

/** True when the server queue moved on but the listener is still mid-song. */
export function isServerAheadMidSong(args: {
  trackIdentityChanged: boolean;
  isPlaying: boolean;
  pausedAt: number | null;
  currentTime: number;
  duration: number;
  fallbackDurationSeconds?: number;
}): boolean {
  if (!args.trackIdentityChanged || !args.isPlaying || args.pausedAt != null) {
    return false;
  }
  return !isNearRadioTrackEnd(
    args.currentTime,
    args.duration,
    args.fallbackDurationSeconds,
  );
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
