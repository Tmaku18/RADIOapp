'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  discoveryApi,
  type DiscoveryMapArtistMarker,
  type DiscoveryMapCluster,
  type DiscoveryMapHeatBucket,
} from '@/lib/api';
import { artistProfilePath } from '@/lib/artist-links';

const artistIcon = new L.DivIcon({
  className: 'artist-marker',
  html: '<div style="background:#111827;border:2px solid #fff;color:#fff;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;">♪</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function boundsToParams(bounds: L.LatLngBounds) {
  return {
    minLat: bounds.getSouth(),
    maxLat: bounds.getNorth(),
    minLng: bounds.getWest(),
    maxLng: bounds.getEast(),
  };
}

function MapEvents({
  onViewportChange,
}: {
  onViewportChange: (zoom: number, bounds: L.LatLngBounds) => void;
}) {
  const map = useMapEvents({
    moveend() {
      onViewportChange(map.getZoom(), map.getBounds());
    },
    zoomend() {
      onViewportChange(map.getZoom(), map.getBounds());
    },
  });
  useEffect(() => {
    onViewportChange(map.getZoom(), map.getBounds());
  }, [map, onViewportChange]);
  return null;
}

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
  const [zoom, setZoom] = useState(4);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [loading, setLoading] = useState(false);
  const [maxIntensity, setMaxIntensity] = useState(0);

  const fetchLayers = useCallback(
    async (nextZoom: number, nextBounds: L.LatLngBounds) => {
      setLoading(true);
      const viewport = boundsToParams(nextBounds);
      try {
        const [heatRes, clusterRes] = await Promise.all([
          discoveryApi.getMapHeat({
            station: stationId || undefined,
            role: role ?? 'artist',
            zoom: nextZoom,
            ...viewport,
          }),
          discoveryApi.getMapClusters({
            station: stationId || undefined,
            role: role ?? 'artist',
            zoom: nextZoom,
            ...viewport,
          }),
        ]);
        setHeat(heatRes.data.buckets);
        setMaxIntensity(heatRes.data.maxIntensity || 0);
        setClusters(clusterRes.data.clusters);

        if (nextZoom >= 8) {
          const artistsRes = await discoveryApi.getMapArtists({
            station: stationId || undefined,
            role: role ?? 'artist',
            ...viewport,
            limit: 120,
          });
          setArtists(artistsRes.data.items);
        } else {
          setArtists([]);
        }
      } catch (error) {
        console.error('Failed to load discovery map layers:', error);
      } finally {
        setLoading(false);
      }
    },
    [role, stationId],
  );

  const handleViewportChange = useCallback(
    (nextZoom: number, nextBounds: L.LatLngBounds) => {
      setZoom(nextZoom);
      setBounds(nextBounds);
    },
    [],
  );

  useEffect(() => {
    if (!bounds) return;
    const timer = window.setTimeout(() => {
      void fetchLayers(zoom, bounds);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [bounds, fetchLayers, zoom]);

  const palette = useMemo(
    () => ['#d1fae5', '#6ee7b7', '#34d399', '#10b981', '#059669', '#065f46'],
    [],
  );

  const colorForIntensity = useCallback(
    (value: number) => {
      if (maxIntensity <= 0) return palette[0];
      const ratio = Math.max(0, Math.min(1, value / maxIntensity));
      const index = Math.min(
        palette.length - 1,
        Math.floor(ratio * (palette.length - 1)),
      );
      return palette[index];
    },
    [maxIntensity, palette],
  );

  return (
    <div className="space-y-3">
      <div className="h-[460px] rounded-xl overflow-hidden border border-border">
        <MapContainer
          center={[39, -98]}
          zoom={4}
          minZoom={3}
          maxZoom={13}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onViewportChange={handleViewportChange} />

          {heat.map((bucket, index) => (
            <Circle
              key={`${bucket.lat}-${bucket.lng}-${index}`}
              center={[bucket.lat, bucket.lng]}
              radius={Math.max(9000, bucket.artistCount * 2500)}
              pathOptions={{
                color: colorForIntensity(bucket.intensity),
                fillColor: colorForIntensity(bucket.intensity),
                fillOpacity: 0.25,
                weight: 0.6,
              }}
            >
              <Popup>
                <div className="text-xs">
                  <p>
                    <strong>{bucket.artistCount}</strong> artists
                  </p>
                  <p>
                    <strong>{bucket.totalLikes}</strong> total likes
                  </p>
                </div>
              </Popup>
            </Circle>
          ))}

          {clusters.map((cluster) => (
            <CircleMarker
              key={cluster.id}
              center={[cluster.lat, cluster.lng]}
              radius={Math.min(26, 8 + cluster.artistCount * 1.2)}
              pathOptions={{
                color: '#1d4ed8',
                fillColor: '#60a5fa',
                fillOpacity: 0.8,
                weight: 1,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedCluster(cluster);
                  void discoveryApi
                    .getMapArtists({
                      station: stationId || undefined,
                      role: role ?? 'artist',
                      clusterLat: cluster.lat,
                      clusterLng: cluster.lng,
                      clusterRadiusKm: cluster.radiusKm,
                      limit: 150,
                    })
                    .then((res) => setArtists(res.data.items))
                    .catch((err) =>
                      console.error('Failed to load cluster artists:', err),
                    );
                },
              }}
            >
              <Popup>
                <div className="text-xs">
                  <p>
                    <strong>{cluster.artistCount}</strong> artists
                  </p>
                  <p>
                    <strong>{cluster.totalLikes}</strong> likes
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {artists.map((artist) => (
            <Marker
              key={artist.artistId}
              position={[artist.lat, artist.lng]}
              icon={artistIcon}
            >
              <Popup>
                <div className="text-xs space-y-1 min-w-[150px]">
                  <p className="font-medium">{artist.displayName || 'Artist'}</p>
                  <p className="text-muted-foreground">{artist.locationRegion || 'Unknown location'}</p>
                  <p>{artist.likeCount} likes</p>
                  <Link
                    href={artistProfilePath(artist.artistId)}
                    className="text-blue-600 hover:underline"
                  >
                    Open profile
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="rounded-lg border border-border bg-card/40 p-3 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          Heat key: low <span className="mx-1">◌</span> high
        </span>
        <span>
          {loading
            ? 'Updating map...'
            : selectedCluster
              ? `Cluster selected: ${selectedCluster.artistCount} artists`
              : 'Tip: click cluster centers to drill down'}
        </span>
      </div>
    </div>
  );
}
