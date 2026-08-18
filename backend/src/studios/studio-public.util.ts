import {
  approximatePublicCoords,
  LOCATION_VICINITY_RADIUS_KM,
} from '../common/geocode.util';

export type StudioLocationPrecision = 'exact' | 'approximate';
export type StudioRateUnit = 'hour' | 'day' | 'half_day' | 'session';

export type DirectoryInclude = {
  people: boolean;
  studios: boolean;
};

/**
 * `include` query: "people", "studios", "people,studios", "all", or empty.
 * Empty / unknown defaults to both so older clients keep seeing people.
 */
export function parseDirectoryInclude(include?: string | null): DirectoryInclude {
  const raw = (include ?? '').trim().toLowerCase();
  if (!raw || raw === 'all') return { people: true, studios: true };
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    people: parts.includes('people') || parts.includes('person'),
    studios: parts.includes('studios') || parts.includes('studio'),
  };
}

export function startingAtFromRates(
  rates: Array<{ price_cents?: number | null; unit?: string | null }>,
): { cents: number | null; unit: StudioRateUnit | null } {
  let best: { cents: number; unit: StudioRateUnit } | null = null;
  for (const rate of rates) {
    const cents = rate.price_cents;
    if (cents == null || !Number.isFinite(Number(cents))) continue;
    const unit = normalizeRateUnit(rate.unit);
    if (!best || Number(cents) < best.cents) {
      best = { cents: Number(cents), unit };
    }
  }
  return best
    ? { cents: best.cents, unit: best.unit }
    : { cents: null, unit: null };
}

export function normalizeRateUnit(unit?: string | null): StudioRateUnit {
  const u = (unit ?? '').trim().toLowerCase();
  if (u === 'day' || u === 'half_day' || u === 'session') return u;
  return 'hour';
}

export function normalizePrecision(
  value?: string | null,
): StudioLocationPrecision {
  return value === 'exact' ? 'exact' : 'approximate';
}

/**
 * Public studio coordinates. Exact studios publish the geocoded street
 * point with no vicinity circle. Approximate studios reuse the people
 * treatment (fuzzed ZIP centroid + 3 km circle).
 */
export function publishStudioLocation(
  lat: number,
  lng: number,
  studioId: string,
  precision: StudioLocationPrecision,
): { lat: number; lng: number; vicinityRadiusKm: number | null } {
  if (precision === 'exact') {
    return {
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      vicinityRadiusKm: null,
    };
  }
  const approx = approximatePublicCoords(lat, lng, studioId);
  return {
    lat: approx.lat,
    lng: approx.lng,
    vicinityRadiusKm: LOCATION_VICINITY_RADIUS_KM,
  };
}
