/** How early the next track should start overlapping the current one. */
export const CROSSFADE_MS = 3_000;

export interface LastGoodTrack {
  id?: string;
  title?: string;
  artist_name?: string;
  audio_url?: string | null;
  artwork_url?: string | null;
  duration_seconds?: number;
}

/**
 * When the live queue is empty, replay the last song Redis still has, or a
 * short jingle, instead of handing the player silence.
 */
export function buildDegradedStation(params: {
  now: string;
  lastGood: LastGoodTrack | null;
  jingleUrl: string | null;
}): Record<string, unknown> | null {
  const last = params.lastGood;
  if (last?.id && last.audio_url) {
    return {
      id: last.id,
      title: last.title ?? 'Last played',
      artist_name: last.artist_name ?? 'NetworX',
      audio_url: last.audio_url,
      artwork_url: last.artwork_url ?? null,
      duration_seconds: last.duration_seconds ?? 30,
      is_playing: true,
      started_at: params.now,
      server_time: params.now,
      time_remaining_ms: (last.duration_seconds ?? 30) * 1000,
      position_seconds: 0,
      is_fallback: true,
      degraded: true,
      no_content: false,
      message: 'The live queue is empty. Playing the last song we still have.',
    };
  }
  if (params.jingleUrl) {
    return {
      id: 'station-jingle',
      title: 'Station break',
      artist_name: 'NetworX',
      audio_url: params.jingleUrl,
      artwork_url: null,
      duration_seconds: 15,
      is_playing: true,
      started_at: params.now,
      server_time: params.now,
      time_remaining_ms: 15_000,
      position_seconds: 0,
      is_fallback: true,
      is_jingle: true,
      degraded: true,
      no_content: false,
      message: 'The live queue is empty. Here is a short station break.',
    };
  }
  return null;
}
