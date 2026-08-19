'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { discoveryApi, type PeopleDirectoryItem } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const NearbyStudiosMap = dynamic(
  () =>
    import('@/components/pro-networx/NearbyStudiosMap').then(
      (m) => m.NearbyStudiosMap,
    ),
  { ssr: false },
);

const KM_PER_MILE = 1.609344;

function formatStartingAt(item: PeopleDirectoryItem): string | null {
  if (item.startingAtCents == null) return null;
  const dollars = (item.startingAtCents / 100).toFixed(
    item.startingAtCents % 100 === 0 ? 0 : 2,
  );
  const unit = item.startingAtUnit;
  const suffix =
    unit === 'day'
      ? '/day'
      : unit === 'half_day'
        ? '/half day'
        : unit === 'session'
          ? '/session'
          : '/hr';
  return `Starting at $${dollars}${suffix}`;
}

function formatDistance(item: PeopleDirectoryItem): string | null {
  if (typeof item.distanceKm !== 'number') return null;
  return `${(item.distanceKm / KM_PER_MILE).toFixed(1)} mi`;
}

export function NearbyStudiosPanel({
  studioPrefix = '/pro-networx/studios',
}: {
  studioPrefix?: string;
}) {
  const [items, setItems] = useState<PeopleDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const radiusRef = useRef(radiusMiles);
  radiusRef.current = radiusMiles;

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  const load = useCallback(
    async (applyRadius: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await discoveryApi.listPeopleDirectory({
          include: 'studios',
          limit: 300,
          lat: userLat ?? undefined,
          lng: userLng ?? undefined,
          radiusKm:
            applyRadius && userLat != null && userLng != null
              ? radiusRef.current * KM_PER_MILE
              : undefined,
        });
        setItems(res.data.items ?? []);
      } catch (e) {
        console.error('Failed to load nearby studios:', e);
        setError('Could not load nearby studios.');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [userLat, userLng],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium">
            Within {radiusMiles} mi
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={radiusMiles}
            onChange={(e) => setRadiusMiles(Number(e.target.value))}
            onMouseUp={() => void load(true)}
            onTouchEnd={() => void load(true)}
            className="w-full mt-1"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Studios can publish an exact pin.
            {userLat != null
              ? ' Green mark is you.'
              : ' Enable location to center the map.'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load(false)}
        >
          Show all
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'map')}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
              No studios nearby yet. Publish a studio page, or tap Show all.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const hero = item.heroImageUrl || item.avatarUrl;
                const price = formatStartingAt(item);
                const dist = formatDistance(item);
                return (
                  <Link key={item.id} href={`${studioPrefix}/${item.id}`}>
                    <Card className="overflow-hidden h-full hover:border-cyan-400/50 transition-colors p-0">
                      {hero ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={hero}
                          alt=""
                          className="w-full h-36 object-cover"
                        />
                      ) : (
                        <div className="w-full h-36 bg-amber-400/10" />
                      )}
                      <div className="p-4">
                        <div className="text-xs uppercase tracking-widest text-amber-300 mb-2">
                          Studio
                          {dist ? ` · ${dist}` : ''}
                        </div>
                        <div className="font-semibold text-foreground">
                          {item.displayName ?? item.name ?? 'Studio'}
                        </div>
                        {(item.tagline || item.headline) && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {item.tagline || item.headline}
                          </p>
                        )}
                        {price && (
                          <p className="text-sm text-cyan-300 mt-3">{price}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {[item.hoursSummary, item.city, item.zipCode]
                            .filter(Boolean)
                            .join(' · ') || 'Location coming soon'}
                        </p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="map" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          ) : (
            <NearbyStudiosMap
              items={items}
              userLat={userLat}
              userLng={userLng}
              studioPrefix={studioPrefix}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
