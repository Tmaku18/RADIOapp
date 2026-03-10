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

/** GA bounds for even spacing: southWest [30.36, -85.6], northEast [35.0, -80.84] */
const GA_SW: [number, number] = [30.36, -85.6];
const GA_NE: [number, number] = [35.0, -80.84];
const GA_LAT_SPAN = GA_NE[0] - GA_SW[0];
const GA_LNG_SPAN = GA_NE[1] - GA_SW[1];
/** Offset from edges so markers sit evenly in the state */
const PAD = 0.15;
const lat = (row: number) => GA_SW[0] + PAD * GA_LAT_SPAN + (row / 1) * (1 - 2 * PAD) * GA_LAT_SPAN;
const lng = (col: number) => GA_SW[1] + PAD * GA_LNG_SPAN + (col / 1) * (1 - 2 * PAD) * GA_LNG_SPAN;

/** Towers evenly spaced across Georgia (NW, NE, SW, SE) */
export const TOWERS: Tower[] = [
  {
    id: 'ga-nw-rap',
    state: 'GA',
    city: 'Rome',
    genre: 'Rap',
    genreId: 'rap',
    lat: lat(1),
    lng: lng(0),
  },
  {
    id: 'ga-ne-edm',
    state: 'GA',
    city: 'Augusta',
    genre: 'EDM',
    genreId: 'edm',
    lat: lat(1),
    lng: lng(1),
  },
  {
    id: 'ga-sw-rnb',
    state: 'GA',
    city: 'Albany',
    genre: 'R&B',
    genreId: 'rnb',
    lat: lat(0),
    lng: lng(0),
  },
  {
    id: 'ga-se-podcasts',
    state: 'GA',
    city: 'Savannah',
    genre: 'Podcasts',
    genreId: 'podcasts',
    lat: lat(0),
    lng: lng(1),
  },
];

export function getTowersForState(stateCode: string): Tower[] {
  return TOWERS.filter((t) => t.state === stateCode);
}

export function getStationById(stationId: string): Tower | undefined {
  return TOWERS.find((t) => t.id === stationId);
}
