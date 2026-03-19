export const RAP_STATION_ID = 'us-rap' as const;
export const READY_NOW_RAP_STATION_ID = 'us-ready-now-rap' as const;
export const HIP_HOP_STATION_ID = 'us-hip-hop' as const;
export const COUNTRY_STATION_ID = 'us-country' as const;
export const ROCK_STATION_ID = 'us-rock' as const;
export const POP_STATION_ID = 'us-pop' as const;
export const EDM_STATION_ID = 'us-edm' as const;
export const RNB_STATION_ID = 'us-rnb' as const;
export const PODCASTS_STATION_ID = 'us-podcasts' as const;
export const SPOKEN_WORD_STATION_ID = 'us-spoken-word' as const;
export const COMEDIAN_STATION_ID = 'us-comedian' as const;
export const GOSPEL_STATION_ID = 'us-gospel' as const;

export const STATION_IDS = [
  RAP_STATION_ID,
  READY_NOW_RAP_STATION_ID,
  HIP_HOP_STATION_ID,
  COUNTRY_STATION_ID,
  ROCK_STATION_ID,
  POP_STATION_ID,
  EDM_STATION_ID,
  RNB_STATION_ID,
  PODCASTS_STATION_ID,
  SPOKEN_WORD_STATION_ID,
  COMEDIAN_STATION_ID,
  GOSPEL_STATION_ID,
] as const;

export type StationId = (typeof STATION_IDS)[number];

export const LEGACY_DEFAULT_STATION_IDS = ['global', 'default'] as const;

const LEGACY_STATION_ID_MAP: Record<string, StationId> = {
  'ga-nw-rap': RAP_STATION_ID,
  'ga-atl-hip-hop': HIP_HOP_STATION_ID,
  'ga-north-country': COUNTRY_STATION_ID,
  'ga-west-rock': ROCK_STATION_ID,
  'ga-east-pop': POP_STATION_ID,
  'ga-ne-edm': EDM_STATION_ID,
  'ga-sw-rnb': RNB_STATION_ID,
  'ga-se-podcasts': PODCASTS_STATION_ID,
  'ga-central-spoken-word': SPOKEN_WORD_STATION_ID,
  'ga-coast-comedian': COMEDIAN_STATION_ID,
  'us-christian': GOSPEL_STATION_ID,
};

export function normalizeSongStationId(radioId?: string | null): StationId {
  const trimmed = (radioId ?? '').trim();
  if (!trimmed || LEGACY_DEFAULT_STATION_IDS.includes(trimmed as any)) {
    return RAP_STATION_ID;
  }
  const legacyMapped = LEGACY_STATION_ID_MAP[trimmed];
  if (legacyMapped) {
    return legacyMapped;
  }
  if (STATION_IDS.includes(trimmed as StationId)) {
    return trimmed as StationId;
  }
  return RAP_STATION_ID;
}
