'use client';

import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import {
  STATE_BOUNDS,
  US_BOUNDS,
  TOWERS,
  type Tower,
} from '@/data/station-map';
import 'leaflet/dist/leaflet.css';

const GENRE_SYMBOLS: Record<string, string> = {
  rap: '🎤',
  'hip-hop': '🎧',
  country: '🤠',
  rock: '🎸',
  pop: '🌟',
  edm: '⚡',
  rnb: '♪',
  podcasts: '🎙',
  'spoken-word': '📜',
  comedian: '🎭',
  gospel: '✝️',
  classical: '🎻',
  emo: '🖤',
  'ai-created': '🤖',
  beats: '🥁',
  freestyle: '🎙️',
  instrumental: '🎼',
  lofi: '🌙',
  jazz: '🎷',
  audiobook: '📚',
  spanish: '💃',
};

function MapController({
  selectedState,
  hasTowers,
}: {
  selectedState: string | null;
  hasTowers: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedState && STATE_BOUNDS[selectedState]) {
      const b = STATE_BOUNDS[selectedState];
      const bounds: LatLngBoundsExpression = [b.southWest, b.northEast];
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: b.zoom });
    } else {
      map.fitBounds([US_BOUNDS.southWest, US_BOUNDS.northEast], {
        padding: [24, 24],
      });
    }
  }, [map, selectedState, hasTowers]);

  return null;
}

function createTowerIcon(tower: Tower) {
  const symbol = GENRE_SYMBOLS[tower.genreId] ?? '📻';
  return L.divIcon({
    className: 'tower-marker-icon border-0 bg-transparent',
    html: `
      <div class="tower-marker" role="button" tabindex="0" aria-label="${tower.genre} - ${tower.city}" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div class="tower-badge" style="width:36px;height:36px;border-radius:9999px;background:rgba(0,245,255,0.9);color:#0A0A0A;font-size:1rem;font-weight:600;display:flex;align-items:center;justify-content:center;border:2px solid #0A0A0A;box-shadow:0 2px 8px rgba(0,0,0,0.3);" title="${tower.genre}">${symbol}</div>
        <div style="font-size:0.75rem;font-weight:500;margin-top:4px;white-space:nowrap;background:rgba(10,10,10,0.9);color:#F5F5F5;padding:2px 8px;border-radius:4px;">${tower.genre}</div>
      </div>
    `,
    iconSize: [48, 56],
    iconAnchor: [24, 56],
  });
}

export function StationPickerMap({
  onSelectStation,
}: {
  onSelectStation: (stationId: string) => void;
}) {
  const [mapReady, setMapReady] = useState(false);
  const towers = TOWERS;

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={[39, -98]}
        zoom={4}
        className="w-full h-full min-h-[400px] z-0"
        zoomControl={true}
        attributionControl={true}
        whenReady={() => setMapReady(true)}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {mapReady && (
          <MapController selectedState={null} hasTowers={towers.length > 0} />
        )}

        {towers.map((tower) => (
          <Marker
            key={tower.id}
            position={[tower.lat, tower.lng]}
            icon={createTowerIcon(tower)}
            eventHandlers={{
              click: () => onSelectStation(tower.id),
            }}
            zIndexOffset={100}
          />
        ))}
      </MapContainer>

      {/* Hint when no state selected */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] px-3 py-2 rounded-md bg-background/90 border border-border text-sm text-muted-foreground">
        Click any station marker to tune in
      </div>
    </div>
  );
}
