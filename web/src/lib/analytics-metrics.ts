/** Canonical copy for Listens vs Ears Reached across web UI. */
export const ANALYTICS_METRICS = {
  listens: {
    label: 'Listens',
    description: 'People who heard a song (once per song per person)',
    shortSub: 'once per song',
  },
  earsReached: {
    label: 'Ears Reached',
    description: 'Unique listeners — each account or device counts once',
    shortSub: 'unique accounts',
  },
  spins: {
    label: 'Spins',
    description: 'Total radio play events',
    shortSub: 'play events',
  },
  liveListeners: {
    label: 'Live Listeners',
    description: 'Prospectors tuned in right now',
    shortSub: 'tuned in now',
  },
} as const;

export function formatMetricCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K+`;
  return n.toLocaleString();
}

/** Per-song or catalog listen count (API: totalListenCount / listens / listenCount). */
export function resolveListens(song: {
  listens?: number;
  totalListenCount?: number;
  listenCount?: number;
  playCount?: number;
  profilePlayCount?: number;
  earsReached?: number;
}): number {
  if (typeof song.listens === 'number') return song.listens;
  if (typeof song.totalListenCount === 'number') return song.totalListenCount;
  if (typeof song.listenCount === 'number') return song.listenCount;
  if (typeof song.playCount === 'number' || typeof song.profilePlayCount === 'number') {
    return (song.playCount ?? 0) + (song.profilePlayCount ?? 0);
  }
  if (typeof song.earsReached === 'number') return song.earsReached;
  return 0;
}
