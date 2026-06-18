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
