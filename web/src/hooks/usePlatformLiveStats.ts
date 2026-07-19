'use client';

import { useEffect, useState } from 'react';

const POLL_MS = 15_000;

export type PlatformLiveStats = {
  liveListeners: number;
  listens: number;
  earsReached: number;
};

type LiveStatsResponse = {
  liveListeners?: number;
  listens?: number;
  earsReached?: number;
};

export function usePlatformLiveStats(initial: PlatformLiveStats): PlatformLiveStats {
  const [stats, setStats] = useState(initial);

  useEffect(() => {
    setStats(initial);
  }, [initial.liveListeners, initial.listens, initial.earsReached]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/analytics/platform/live?t=${Date.now()}`,
          { cache: 'no-store' },
        );
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as LiveStatsResponse;
        if (cancelled) return;
        setStats({
          liveListeners: Math.max(0, Number(data.liveListeners) || 0),
          listens: Math.max(0, Number(data.listens) || 0),
          earsReached: Math.max(0, Number(data.earsReached) || 0),
        });
      } catch {
        // Keep last known values on transient errors.
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return stats;
}
