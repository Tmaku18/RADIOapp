/**
 * Station picker map data: US state bounds and genre towers per metro.
 * Used by StationPickerMap for zoom and tower markers.
 */

export type GenreId =
  | 'rap'
  | 'hip-hop'
  | 'country'
  | 'rock'
  | 'pop'
  | 'edm'
  | 'rnb'
  | 'podcasts'
  | 'spoken-word'
  | 'comedian'
  | 'christian';

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

/** State code -> bounds and zoom (GA kept for backward compatibility) */
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

/** National stations distributed on the US map for easier picking. */
export const TOWERS: Tower[] = [
  {
    id: 'us-rap',
    state: 'US',
    city: 'New York',
    genre: 'Rap',
    genreId: 'rap',
    lat: 40.7128,
    lng: -74.006,
  },
  {
    id: 'us-hip-hop',
    state: 'US',
    city: 'Atlanta',
    genre: 'Hip Hop',
    genreId: 'hip-hop',
    lat: 33.749,
    lng: -84.388,
  },
  {
    id: 'us-country',
    state: 'US',
    city: 'Nashville',
    genre: 'Country',
    genreId: 'country',
    lat: 36.1627,
    lng: -86.7816,
  },
  {
    id: 'us-rock',
    state: 'US',
    city: 'Chicago',
    genre: 'Rock',
    genreId: 'rock',
    lat: 41.8781,
    lng: -87.6298,
  },
  {
    id: 'us-pop',
    state: 'US',
    city: 'Los Angeles',
    genre: 'Pop',
    genreId: 'pop',
    lat: 34.0522,
    lng: -118.2437,
  },
  {
    id: 'us-edm',
    state: 'US',
    city: 'Las Vegas',
    genre: 'EDM',
    genreId: 'edm',
    lat: 36.1699,
    lng: -115.1398,
  },
  {
    id: 'us-rnb',
    state: 'US',
    city: 'New Orleans',
    genre: 'R&B',
    genreId: 'rnb',
    lat: 29.9511,
    lng: -90.0715,
  },
  {
    id: 'us-podcasts',
    state: 'US',
    city: 'Seattle',
    genre: 'Podcasts',
    genreId: 'podcasts',
    lat: 47.6062,
    lng: -122.3321,
  },
  {
    id: 'us-spoken-word',
    state: 'US',
    city: 'Washington',
    genre: 'Spoken Word',
    genreId: 'spoken-word',
    lat: 38.9072,
    lng: -77.0369,
  },
  {
    id: 'us-comedian',
    state: 'US',
    city: 'Austin',
    genre: 'Comedian',
    genreId: 'comedian',
    lat: 30.2672,
    lng: -97.7431,
  },
  {
    id: 'us-christian',
    state: 'US',
    city: 'Dallas',
    genre: 'Christian',
    genreId: 'christian',
    lat: 32.7767,
    lng: -96.797,
  },
];

export function getTowersForState(stateCode: string): Tower[] {
  return TOWERS.filter((t) => t.state === stateCode);
}

export function getStationById(stationId: string): Tower | undefined {
  return TOWERS.find((t) => t.id === stationId);
}
