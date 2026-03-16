'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  discoveryApi,
  type DiscoveryMapArtistMarker,
  type DiscoveryMapCluster,
  type DiscoveryMapHeatBucket,
} from '@/lib/api';

export function DiscoveryHeatMap({
  stationId,
  role,
}: {
  stationId?: string;
  role?: 'artist' | 'service_provider' | 'all';
}) {
  const [heat, setHeat] = useState<DiscoveryMapHeatBucket[]>([]);
  const [clusters, setClusters] = useState<DiscoveryMapCluster[]>([]);
  const [artists, setArtists] = useState<DiscoveryMapArtistMarker[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<DiscoveryMapCluster | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [heatRes, clusterRes] = await Promise.all([
          discoveryApi.getMapHeat({
            station: stationId || undefined,
            role: role ?? 'all',
            zoom: 4,
            minLat: 24.5,
            maxLat: 49.5,
            minLng: -125,
            maxLng: -66,
          }),
          discoveryApi.getMapClusters({
            station: stationId || undefined,
            role: role ?? 'all',
            zoom: 4,
            minLat: 24.5,
            maxLat: 49.5,
            minLng: -125,
            maxLng: -66,
          }),
        ]);
        setHeat(heatRes.data.buckets);
        setClusters(clusterRes.data.clusters);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [role, stationId]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <p className="text-sm text-muted-foreground mb-2">
          Discovery map data (heat + clusters) is available below.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-medium mb-2">Heat Areas</h3>
            <div className="space-y-2 max-h-[260px] overflow-auto pr-2">
              {heat.slice(0, 20).map((bucket, index) => (
                <div key={`${bucket.lat}-${bucket.lng}-${index}`} className="rounded-md border border-border p-2 text-sm">
                  <p>{bucket.totalLikes} likes • {bucket.artistCount} artists</p>
                  <p className="text-xs text-muted-foreground">{bucket.lat.toFixed(2)}, {bucket.lng.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">Clusters</h3>
            <div className="space-y-2 max-h-[260px] overflow-auto pr-2">
              {clusters.slice(0, 20).map((cluster) => (
                <button
                  key={cluster.id}
                  type="button"
                  className={`w-full rounded-md border p-2 text-left text-sm ${selectedCluster?.id === cluster.id ? 'border-primary bg-primary/10' : 'border-border'}`}
                  onClick={() => {
                    setSelectedCluster(cluster);
                    void discoveryApi
                      .getMapArtists({
                        station: stationId || undefined,
                        role: role ?? 'all',
                        clusterLat: cluster.lat,
                        clusterLng: cluster.lng,
                        clusterRadiusKm: cluster.radiusKm,
                        limit: 120,
                      })
                      .then((res) => setArtists(res.data.items));
                  }}
                >
                  <p>{cluster.artistCount} artists • {cluster.totalLikes} likes</p>
                  <p className="text-xs text-muted-foreground">{cluster.lat.toFixed(2)}, {cluster.lng.toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-4">
        <h3 className="font-medium mb-2">Artists in selected cluster</h3>
        <div className="space-y-2">
          {artists.slice(0, 30).map((artist) => (
            <div key={artist.artistId} className="rounded-md border border-border p-2 text-sm flex items-center justify-between">
              <div>
                <p>{artist.displayName || 'Artist'}</p>
                <p className="text-xs text-muted-foreground">
                  {artist.locationRegion || 'Unknown location'} • {artist.likeCount} likes
                </p>
              </div>
              <Link href={`/u/${artist.artistId}`} className="text-primary text-xs hover:underline">
                Profile
              </Link>
            </div>
          ))}
          {!loading && artists.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Click a cluster to load artists in that area.
            </p>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card/40 p-3 text-xs text-muted-foreground">
        {loading ? 'Updating map data...' : 'Cluster drill-down is active.'}
      </div>
    </div>
  );
}
