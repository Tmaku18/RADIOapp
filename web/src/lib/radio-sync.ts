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

type NextTrackPayload = Record<string, unknown> & {
  id?: string;
  no_content?: boolean;
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
  }) => Promise<{ data: NextTrackPayload }>;
}): Promise<NextTrackPayload | null> {
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
