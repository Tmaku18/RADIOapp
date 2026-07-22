/**
 * Best-effort city → lat/lng using Open-Meteo (no API key).
 * Used for Nearby People / discovery map pins at city-level only (not street/GPS).
 */

export type GeocodeResult = { lat: number; lng: number };

/** In-process cache so directory lazy-geocode doesn't hammer Open-Meteo. */
const geocodeCache = new Map<string, GeocodeResult | null>();

/**
 * Geocode a place for map pins. Prefer city name; ZIP is only a fallback when
 * city is missing (and results are still fuzzed before clients see them).
 */
export async function geocodeCityZip(
  cityInput: string,
  zipInput?: string | null,
): Promise<GeocodeResult | null> {
  const city = cityInput.trim();
  const zip = (zipInput ?? '').trim();
  // City-only query when possible so pins stay general (city centroid, not ZIP).
  const name = city || zip;
  if (!name) return null;

  const cacheKey = name.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  try {
    const url =
      'https://geocoding-api.open-meteo.com/v1/search?' +
      new URLSearchParams({
        name,
        count: '1',
        language: 'en',
        format: 'json',
      }).toString();

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      geocodeCache.set(cacheKey, null);
      return null;
    }
    const body = (await res.json()) as {
      results?: Array<{ latitude?: number; longitude?: number }>;
    };
    const hit = body.results?.[0];
    const lat = hit?.latitude;
    const lng = hit?.longitude;
    if (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      const result = { lat, lng };
      geocodeCache.set(cacheKey, result);
      return result;
    }
  } catch {
    // Network / timeout — leave coords unset.
  }
  geocodeCache.set(cacheKey, null);
  return null;
}

/**
 * Public map coordinates: coarse cell (~8–10 km) + stable per-user jitter.
 * Hides exact stored coords and spreads people who share a city so pins don't stack.
 */
export function approximatePublicCoords(
  lat: number,
  lng: number,
  seed: string,
): GeocodeResult {
  const cellDeg = 0.08;
  const baseLat = Math.round(lat / cellDeg) * cellDeg;
  const baseLng = Math.round(lng / cellDeg) * cellDeg;

  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const u1 = ((hash >>> 0) % 1000) / 1000;
  const u2 = (((hash >>> 10) % 1000) / 1000);
  const jLat = (u1 - 0.5) * cellDeg * 0.75;
  const jLng = (u2 - 0.5) * cellDeg * 0.75;

  return {
    lat: Math.round((baseLat + jLat) * 1e4) / 1e4,
    lng: Math.round((baseLng + jLng) * 1e4) / 1e4,
  };
}
