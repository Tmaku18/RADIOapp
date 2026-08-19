import {
  approximatePublicCoords,
  LOCATION_VICINITY_RADIUS_KM,
} from '../common/geocode.util';

export type StudioLocationPrecision = 'exact' | 'approximate';
export type StudioRateUnit = 'hour' | 'day' | 'half_day' | 'session';

export const STUDIO_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type StudioHour = {
  day: (typeof STUDIO_DAYS)[number];
  open: string | null;
  close: string | null;
  closed: boolean;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeHours(value: unknown): StudioHour[] {
  if (!Array.isArray(value)) return [];
  const byDay = new Map<string, StudioHour>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const dayRaw = String(rec.day ?? '').trim();
    const day = STUDIO_DAYS.find((d) => d.toLowerCase() === dayRaw.toLowerCase());
    if (!day) continue;
    const closed = rec.closed === true;
    const openRaw = typeof rec.open === 'string' ? rec.open.trim() : '';
    const closeRaw = typeof rec.close === 'string' ? rec.close.trim() : '';
    const open = !closed && TIME_RE.test(openRaw) ? openRaw : null;
    const close = !closed && TIME_RE.test(closeRaw) ? closeRaw : null;
    byDay.set(day, { day, open, close, closed: closed || (!open && !close) });
  }
  return STUDIO_DAYS.filter((d) => byDay.has(d)).map((d) => byDay.get(d)!);
}

export function hoursSummary(hours: StudioHour[]): string | null {
  const openDays = hours.filter((h) => !h.closed && h.open && h.close);
  if (openDays.length === 0) return null;
  if (openDays.length === 1) {
    const h = openDays[0];
    return `${h.day} ${h.open}–${h.close}`;
  }
  const first = openDays[0];
  const last = openDays[openDays.length - 1];
  const same = openDays.every(
    (h) => h.open === first.open && h.close === first.close,
  );
  if (same && openDays.length === hours.filter((h) => !h.closed).length) {
    return `${first.day}–${last.day} ${first.open}–${first.close}`;
  }
  return `${openDays.length} days · ${first.open}–${first.close}`;
}

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
