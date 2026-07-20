/**
 * Best-effort city/ZIP → lat/lng using Open-Meteo (no API key).
 * Used to place Nearby People / discovery map pins when a user sets their city.
 */

export type GeocodeResult = { lat: number; lng: number };

export async function geocodeCityZip(
  cityInput: string,
  zipInput?: string | null,
): Promise<GeocodeResult | null> {
  const city = cityInput.trim();
  const zip = (zipInput ?? '').trim();
  if (!city && !zip) return null;

  const name = [city, zip].filter(Boolean).join(' ');
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
    if (!res.ok) return null;
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
      return { lat, lng };
    }
  } catch {
    // Network / timeout — leave coords unset.
  }
  return null;
}
