import {
  approximatePublicCoords,
  LOCATION_VICINITY_RADIUS_KM,
  resolveGeocodeQuery,
} from './geocode.util';

describe('resolveGeocodeQuery', () => {
  it('prefers ZIP over city so pins are postal-area based', () => {
    expect(resolveGeocodeQuery('Atlanta', '30318')).toBe('30318');
  });

  it('strips ZIP+4 down to the 5-digit postal area', () => {
    expect(resolveGeocodeQuery('Atlanta', '30318-1234')).toBe('30318');
  });

  it('falls back to city when ZIP is missing', () => {
    expect(resolveGeocodeQuery('Atlanta', null)).toBe('Atlanta');
    expect(resolveGeocodeQuery('Atlanta', '   ')).toBe('Atlanta');
  });

  it('returns null when neither city nor ZIP is set', () => {
    expect(resolveGeocodeQuery('', null)).toBeNull();
  });

  it('keeps non-US postal strings as-is', () => {
    expect(resolveGeocodeQuery('Toronto', 'M5V 2T6')).toBe('M5V 2T6');
  });
});

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Spread of latitudes so the longitude scaling is exercised near the poles. */
const places: Array<[string, number, number]> = [
  ['Atlanta', 33.749, -84.388],
  ['Quito', -0.1807, -78.4678],
  ['Anchorage', 61.2181, -149.9003],
  ['Nuuk', 64.1836, -51.7214],
];

describe('approximatePublicCoords', () => {
  it('never publishes a point at the real location', () => {
    for (const [name, lat, lng] of places) {
      for (let i = 0; i < 500; i += 1) {
        const approx = approximatePublicCoords(lat, lng, `${name}-user-${i}`);
        const moved = haversineKm(lat, lng, approx.lat, approx.lng);
        // A near-zero offset would republish the stored coordinates as-is.
        expect(moved).toBeGreaterThan(0.5);
      }
    }
  });

  it('keeps the real location inside the circle clients draw', () => {
    for (const [name, lat, lng] of places) {
      for (let i = 0; i < 500; i += 1) {
        const approx = approximatePublicCoords(lat, lng, `${name}-user-${i}`);
        const moved = haversineKm(lat, lng, approx.lat, approx.lng);
        expect(moved).toBeLessThanOrEqual(LOCATION_VICINITY_RADIUS_KM);
      }
    }
  });

  it('returns the same point every time for a given user', () => {
    // Re-rolling per request would let a caller average many samples back to
    // the true coordinates.
    const first = approximatePublicCoords(33.749, -84.388, 'stable-user');
    for (let i = 0; i < 10; i += 1) {
      const again = approximatePublicCoords(33.749, -84.388, 'stable-user');
      expect(again).toEqual(first);
    }
  });

  it('separates people who share one city centroid', () => {
    const a = approximatePublicCoords(33.749, -84.388, 'user-a');
    const b = approximatePublicCoords(33.749, -84.388, 'user-b');
    expect(haversineKm(a.lat, a.lng, b.lat, b.lng)).toBeGreaterThan(0.1);
  });

  it('honours a custom radius', () => {
    const approx = approximatePublicCoords(33.749, -84.388, 'user-a', 10);
    const moved = haversineKm(33.749, -84.388, approx.lat, approx.lng);
    expect(moved).toBeGreaterThan(LOCATION_VICINITY_RADIUS_KM);
    expect(moved).toBeLessThanOrEqual(10);
  });

  it('keeps longitude in range near the antimeridian', () => {
    for (let i = 0; i < 200; i += 1) {
      const approx = approximatePublicCoords(-16.5, 179.98, `fiji-${i}`);
      expect(approx.lng).toBeGreaterThanOrEqual(-180);
      expect(approx.lng).toBeLessThanOrEqual(180);
    }
  });
});
