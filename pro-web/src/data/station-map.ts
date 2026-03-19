export interface Tower {
  id: string;
  city: string;
  genre: string;
  lat: number;
  lng: number;
}

export const TOWERS: Tower[] = [
  { id: 'us-rap', city: 'New York', genre: 'Up & Coming Radio', lat: 40.7128, lng: -74.006 },
  {
    id: 'us-ready-now-rap',
    city: 'Houston',
    genre: 'Ready Now Rap Radio',
    lat: 29.7604,
    lng: -95.3698,
  },
  { id: 'us-hip-hop', city: 'Atlanta', genre: 'Hip Hop', lat: 33.749, lng: -84.388 },
  { id: 'us-country', city: 'Nashville', genre: 'Country', lat: 36.1627, lng: -86.7816 },
  { id: 'us-rock', city: 'Chicago', genre: 'Rock', lat: 41.8781, lng: -87.6298 },
  { id: 'us-pop', city: 'Los Angeles', genre: 'Pop', lat: 34.0522, lng: -118.2437 },
  { id: 'us-edm', city: 'Las Vegas', genre: 'EDM', lat: 36.1699, lng: -115.1398 },
  { id: 'us-rnb', city: 'New Orleans', genre: 'R&B', lat: 29.9511, lng: -90.0715 },
  { id: 'us-podcasts', city: 'Seattle', genre: 'Podcasts', lat: 47.6062, lng: -122.3321 },
  { id: 'us-spoken-word', city: 'Washington', genre: 'Spoken Word', lat: 38.9072, lng: -77.0369 },
  { id: 'us-comedian', city: 'Austin', genre: 'Comedian', lat: 30.2672, lng: -97.7431 },
  { id: 'us-gospel', city: 'Dallas', genre: 'Gospel', lat: 32.7767, lng: -96.797 },
];
