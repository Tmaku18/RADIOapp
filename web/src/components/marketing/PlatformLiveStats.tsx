'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ANALYTICS_METRICS, formatMetricCount } from '@/lib/analytics-metrics';
import type { PlatformLiveStats as LiveStats } from '@/hooks/usePlatformLiveStats';

export function PlatformLiveStats({ liveListeners, listens, earsReached }: LiveStats) {
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
