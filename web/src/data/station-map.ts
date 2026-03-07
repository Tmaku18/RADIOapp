/**
 * Station picker map data: US state bounds and genre towers per metro.
 * Used by StationPickerMap for zoom and tower markers.
 */

export type GenreId = 'rap' | 'edm' | 'rnb' | 'podcasts';

export interface Tower {
  id: string;
  state: string;
  city: string;
  genre: string;
  genreId: GenreId;
  lat: number;
  lng: number;
}

/** Leaflet LatLngBounds: [southWest, northEast] = [[latMin, lngMin], [latMax, lngMax]] */
export interface StateBounds {
  southWest: [number, number];
  northEast: [number, number];
  /** Center for zoom; optional override */
  center?: [number, number];
  /** Zoom level when state is selected */
  zoom: number;
}

/** Continental US approximate bounds */
export const US_BOUNDS: StateBounds = {
  southWest: [24.5, -125],
  northEast: [49.5, -66],
  zoom: 4,
};

/** State code -> bounds and zoom (only GA implemented for MVP) */
export const STATE_BOUNDS: Record<string, StateBounds> = {
  GA: {
    southWest: [30.36, -85.6],
    northEast: [35.0, -80.84],
    center: [33.749, -84.388],
    zoom: 9,
  },
};

/** States that have towers (zoom in to see them) */
export const STATES_WITH_TOWERS: string[] = ['GA'];

/** Towers per metro (Atlanta area for GA) */
const ATLANTA_LAT = 33.749;
const ATLANTA_LNG = -84.388;

export const TOWERS: Tower[] = [
  {
    id: 'atlanta-rap',
    state: 'GA',
    city: 'Atlanta',
    genre: 'Rap',
    genreId: 'rap',
    lat: ATLANTA_LAT + 0.08,
    lng: ATLANTA_LNG - 0.05,
  },
  {
    id: 'atlanta-edm',
    state: 'GA',
    city: 'Atlanta',
    genre: 'EDM',
    genreId: 'edm',
    lat: ATLANTA_LAT - 0.06,
    lng: ATLANTA_LNG + 0.08,
  },
  {
    id: 'atlanta-rnb',
    state: 'GA',
    city: 'Atlanta',
    genre: 'R&B',
    genreId: 'rnb',
    lat: ATLANTA_LAT + 0.05,
    lng: ATLANTA_LNG + 0.06,
  },
  {
    id: 'atlanta-podcasts',
    state: 'GA',
    city: 'Atlanta',
    genre: 'Podcasts',
    genreId: 'podcasts',
    lat: ATLANTA_LAT - 0.07,
    lng: ATLANTA_LNG - 0.04,
  },
];

export function getTowersForState(stateCode: string): Tower[] {
  return TOWERS.filter((t) => t.state === stateCode);
}

export function getStationById(stationId: string): Tower | undefined {
  return TOWERS.find((t) => t.id === stationId);
}
