'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ANALYTICS_METRICS, formatMetricCount } from '@/lib/analytics-metrics';

const POLL_MS = 30_000;

type PlatformLiveStatsProps = {
  initialLiveListeners: number;
  initialListens: number;
  initialEarsReached: number;
};

type LiveStatsResponse = {
  liveListeners?: number;
  listens?: number;
  earsReached?: number;
};

export function PlatformLiveStats({
  initialLiveListeners,
  initialListens,
  initialEarsReached,
}: PlatformLiveStatsProps) {
  const [liveListeners, setLiveListeners] = useState(initialLiveListeners);
  const [listens, setListens] = useState(initialListens);
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
        setListens(Math.max(0, Number(data.listens) || 0));
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
      value: formatMetricCount(liveListeners),
      label: ANALYTICS_METRICS.liveListeners.label,
      sub: `(${ANALYTICS_METRICS.liveListeners.shortSub})`,
      live: true,
    },
    {
      value: formatMetricCount(listens),
      label: ANALYTICS_METRICS.listens.label,
      sub: `(${ANALYTICS_METRICS.listens.shortSub})`,
      live: true,
    },
    {
      value: formatMetricCount(earsReached),
      label: ANALYTICS_METRICS.earsReached.label,
      sub: `(${ANALYTICS_METRICS.earsReached.shortSub})`,
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
