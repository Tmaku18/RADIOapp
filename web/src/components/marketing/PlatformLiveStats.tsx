'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

const POLL_MS = 30_000;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K+`;
  return n.toLocaleString();
}

type PlatformLiveStatsProps = {
  initialLiveListeners: number;
  initialEarsReached: number;
};

type LiveStatsResponse = {
  liveListeners?: number;
  earsReached?: number;
};

export function PlatformLiveStats({
  initialLiveListeners,
  initialEarsReached,
}: PlatformLiveStatsProps) {
  const [liveListeners, setLiveListeners] = useState(initialLiveListeners);
  const [earsReached, setEarsReached] = useState(initialEarsReached);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch('/api/analytics/platform/live', {
          cache: 'no-store',
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as LiveStatsResponse;
        if (cancelled) return;
        setLiveListeners(Math.max(0, Number(data.liveListeners) || 0));
        setEarsReached(Math.max(0, Number(data.earsReached) || 0));
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

  const stats = [
    {
      value: formatCount(liveListeners),
      label: 'Live Listeners',
      sub: '(tuned in now)',
      live: true,
    },
    {
      value: formatCount(earsReached),
      label: 'Ears Reached',
      sub: '(all-time unique)',
      live: true,
    },
  ];

  return (
    <>
      {stats.map((stat) => (
        <Card key={stat.label} className="text-center">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              {stat.live && (
                <span
                  className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
                  aria-hidden
                />
              )}
              <div className="text-4xl font-bold text-primary">{stat.value}</div>
            </div>
            <div className="text-muted-foreground mt-2">{stat.label}</div>
            <div className="text-muted-foreground/80 text-sm mt-0.5">{stat.sub}</div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
