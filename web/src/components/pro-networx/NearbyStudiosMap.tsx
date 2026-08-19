'use client';

import { Fragment, useEffect, useMemo } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import type { PeopleDirectoryItem } from '@/lib/api';

const US_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_VICINITY_KM = 3;

function FitView({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

function studioIcon() {
  return new L.DivIcon({
    className: 'nearby-studio-marker border-0 bg-transparent',
    html: `<div style="width:32px;height:32px;border-radius:9999px;background:rgba(10,10,10,0.85);border:2px solid #f5c14a;display:flex;align-items:center;justify-content:center;color:#f5c14a;font-size:16px;">⌂</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function youIcon() {
  return new L.DivIcon({
    className: 'nearby-you-marker border-0 bg-transparent',
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:#86efac;border:2px solid #14532d;box-shadow:0 0 0 4px rgba(134,239,172,0.25);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function NearbyStudiosMap({
  items,
  userLat,
  userLng,
  studioPrefix = '/pro-networx/studios',
}: {
  items: PeopleDirectoryItem[];
  userLat: number | null;
  userLng: number | null;
  studioPrefix?: string;
}) {
  const mappable = useMemo(
    () =>
      items.filter(
        (item) =>
          typeof item.lat === 'number' &&
          Number.isFinite(item.lat) &&
          typeof item.lng === 'number' &&
          Number.isFinite(item.lng),
      ),
    [items],
  );

  const center: [number, number] =
    userLat != null && userLng != null
      ? [userLat, userLng]
      : mappable[0]
        ? [mappable[0].lat as number, mappable[0].lng as number]
        : US_CENTER;
  const zoom = userLat != null ? 10 : mappable.length ? 6 : 4;
  const icon = useMemo(() => studioIcon(), []);
  const selfIcon = useMemo(() => youIcon(), []);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-[min(70vh,560px)] w-full rounded-xl overflow-hidden border border-border z-0"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitView center={center} zoom={zoom} />
      {mappable.map((item) => {
        const lat = item.lat as number;
        const lng = item.lng as number;
        const exact = item.vicinityRadiusKm == null;
        const radiusKm = item.vicinityRadiusKm ?? DEFAULT_VICINITY_KM;
        return (
          <Fragment key={item.id}>
            {!exact && (
              <Circle
                center={[lat, lng]}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#f5c14a',
                  weight: 1,
                  fillColor: '#f5c14a',
                  fillOpacity: 0.12,
                }}
              />
            )}
            <Marker position={[lat, lng]} icon={icon}>
              <Popup>
                <div className="min-w-[160px]">
                  <div className="font-semibold">
                    {item.displayName ?? item.name ?? 'Studio'}
                  </div>
                  {(item.city || item.zipCode) && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[item.city, item.zipCode].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <Link
                    href={`${studioPrefix}/${item.id}`}
                    className="text-xs text-cyan-600 underline mt-1 inline-block"
                  >
                    Open studio
                  </Link>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
      {userLat != null && userLng != null && (
        <Marker position={[userLat, userLng]} icon={selfIcon} />
      )}
    </MapContainer>
  );
}
