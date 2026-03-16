export const RAP_STATION_ID = 'ga-nw-rap' as const;
export const HIP_HOP_STATION_ID = 'ga-atl-hip-hop' as const;
export const COUNTRY_STATION_ID = 'ga-north-country' as const;
export const ROCK_STATION_ID = 'ga-west-rock' as const;
export const POP_STATION_ID = 'ga-east-pop' as const;
export const EDM_STATION_ID = 'ga-ne-edm' as const;
export const RNB_STATION_ID = 'ga-sw-rnb' as const;
export const PODCASTS_STATION_ID = 'ga-se-podcasts' as const;
export const SPOKEN_WORD_STATION_ID = 'ga-central-spoken-word' as const;
export const COMEDIAN_STATION_ID = 'ga-coast-comedian' as const;

export const STATION_IDS = [
  RAP_STATION_ID,
  HIP_HOP_STATION_ID,
  COUNTRY_STATION_ID,
  ROCK_STATION_ID,
  POP_STATION_ID,
  EDM_STATION_ID,
  RNB_STATION_ID,
  PODCASTS_STATION_ID,
  SPOKEN_WORD_STATION_ID,
  COMEDIAN_STATION_ID,
] as const;

export type StationId = (typeof STATION_IDS)[number];

export const LEGACY_DEFAULT_STATION_IDS = ['global', 'default'] as const;

export function normalizeSongStationId(radioId?: string | null): StationId {
  const trimmed = (radioId ?? '').trim();
  if (!trimmed || LEGACY_DEFAULT_STATION_IDS.includes(trimmed as any)) {
    return RAP_STATION_ID;
  }
  if (STATION_IDS.includes(trimmed as StationId)) {
    return trimmed as StationId;
  }
  return RAP_STATION_ID;
}
