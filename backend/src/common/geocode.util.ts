/**
 * Best-effort place → lat/lng using Open-Meteo (no API key).
 *
 * Map pins are ZIP-based, then deliberately distorted before any client sees
 * them. City is only a fallback when ZIP is missing, and street/GPS is never
 * accepted as a public location.
 */

export type GeocodeResult = { lat: number; lng: number };

/** In-process cache so directory lazy-geocode doesn't hammer Open-Meteo. */
const geocodeCache = new Map<string, GeocodeResult | null>();

/**
 * Build the Open-Meteo search string.
 *
 * ZIP wins when present: a postal-code centroid is the coarsest unit we store
 * that still groups people usefully for Nearby. City alone is the fallback for
 * older profiles that never set a ZIP. The two are never combined into a
 * street-level query.
 */
export function resolveGeocodeQuery(
  cityInput: string,
  zipInput?: string | null,
): string | null {
  const zip = (zipInput ?? '').trim();
  const city = cityInput.trim();
  if (zip) {
    // US ZIPs are 5 digits (optionally +4). Keep the core 5 so Open-Meteo
    // resolves the postal area rather than a house-level +4.
    const usZip = zip.match(/^(\d{5})(?:-\d{4})?$/);
    if (usZip) return usZip[1];
    return zip;
  }
  if (city) return city;
  return null;
}

/**
 * Geocode a place for map pins. Prefer ZIP; city is only a fallback when ZIP
 * is missing. Results are still fuzzed via {@link approximatePublicCoords}
 * before clients see them.
 */
export async function geocodeCityZip(
  cityInput: string,
  zipInput?: string | null,
): Promise<GeocodeResult | null> {
  const name = resolveGeocodeQuery(cityInput, zipInput);
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
 * Radius in km of the "general vicinity" circle published for a person.
 * Clients draw a circle this big around the approximate point; the real
 * ZIP centroid is guaranteed to sit somewhere inside it — never the reverse.
 */
export const LOCATION_VICINITY_RADIUS_KM = 3;

const KM_PER_DEG_LAT = 110.574;

/** FNV-1a plus an avalanche step so similar seeds give unrelated offsets. */
function hash32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** Hash to a float in [0, 1). */
function unitFromSeed(seed: string): number {
  return hash32(seed) / 0x100000000;
}

/**
 * Public map coordinates: shift the ZIP centroid by a fixed offset inside a
 * disc so the published pin never lands on the stored point and never looks
 * like a street address. Also spreads people who share one ZIP so their
 * circles don't stack.
 *
 * The offset is derived from the user id alone and so never changes between
 * requests. Re-rolling it per request would let a caller collect many samples
 * and average them straight back to the true coordinates.
 */
export function approximatePublicCoords(
  lat: number,
  lng: number,
  seed: string,
  radiusKm: number = LOCATION_VICINITY_RADIUS_KM,
): GeocodeResult {
  const angle = unitFromSeed(`${seed}:angle`) * Math.PI * 2;
  // Offset over an annulus, not a full disc. A plain disc occasionally draws a
  // near-zero offset, which would publish someone's real position unchanged.
  // The floor costs a little search area but guarantees every person is moved.
  const minFactor = 0.35;
  const u = unitFromSeed(`${seed}:distance`);
  // sqrt spreads offsets evenly by area rather than clumping them at the
  // inner edge, where they would hide less.
  const spread = Math.sqrt(minFactor ** 2 + (1 - minFactor ** 2) * u);
  // Stay just inside the published radius so the rounding below can never
  // push the true point outside the circle clients draw.
  const distanceKm = radiusKm * 0.98 * spread;

  const dLat = (distanceKm * Math.sin(angle)) / KM_PER_DEG_LAT;
  // A degree of longitude shrinks toward the poles, so scale by cos(lat) to
  // keep the offset circular on the ground instead of oval.
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const dLng = (distanceKm * Math.cos(angle)) / (KM_PER_DEG_LAT * cosLat);

  let outLng = lng + dLng;
  if (outLng > 180) outLng -= 360;
  if (outLng < -180) outLng += 360;

  // The offset above is what protects the location; rounding to ~11 m just
  // avoids publishing precision the approximation doesn't actually have.
  return {
    lat: Math.round(Math.min(90, Math.max(-90, lat + dLat)) * 1e4) / 1e4,
    lng: Math.round(outLng * 1e4) / 1e4,
  };
}
