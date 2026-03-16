'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StationNetworkSelector } from '@/components/discovery/StationNetworkSelector';

const DiscoveryHeatMap = dynamic(
  () =>
    import('@/components/discovery/DiscoveryHeatMap').then(
      (m) => m.DiscoveryHeatMap,
    ),
  { ssr: false },
);

export default function DiscoverPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'station' | 'map'>(() => {
    if (typeof window === 'undefined') return 'station';
    const tab = new URLSearchParams(window.location.search).get('tab');
    return tab === 'map' ? 'map' : 'station';
  });
  const [selectedStationId, setSelectedStationId] = useState(() => {
    if (typeof window === 'undefined') return 'us-rap';
    return (
      new URLSearchParams(window.location.search).get('station')?.trim() ||
      'us-rap'
    );
  });

  useEffect(() => {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : '',
    );
    params.set('tab', activeTab);
    params.set('station', selectedStationId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeTab, pathname, router, selectedStationId]);

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Discovery</h1>
        <p className="text-muted-foreground mt-1">
          Select stations from the node network and explore artist heat clusters.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList variant="line" className="w-full justify-start rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="station" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
            Stations
          </TabsTrigger>
          <TabsTrigger value="map" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
            Map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="station" className="pt-6 space-y-4">
          <StationNetworkSelector stationId={selectedStationId} onSelectStation={setSelectedStationId} />
          <Button asChild>
            <Link href={`https://networxradio.com/listen?station=${encodeURIComponent(selectedStationId)}`} target="_blank" rel="noreferrer">
              Open station on Networx Radio
            </Link>
          </Button>
        </TabsContent>

        <TabsContent value="map" className="pt-6">
          <DiscoveryHeatMap stationId={selectedStationId} role="all" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
