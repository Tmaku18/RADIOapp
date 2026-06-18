const STATION_AUTOPLAY_KEY = 'networx-station-autoplay';
const LAST_RADIO_STATION_KEY = 'networx-last-radio-station';

/** Last radio station the listener tuned to (for station switcher UI). */
export function getLastRadioStationId(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LAST_RADIO_STATION_KEY)?.trim();
  return raw || null;
}

export function setLastRadioStationId(stationId: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = stationId.trim();
  if (!trimmed) return;
  window.localStorage.setItem(LAST_RADIO_STATION_KEY, trimmed);
}

/** Whether tapping a station in Discover should start playback immediately. Default: true. */
export function getStationAutoplayEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(STATION_AUTOPLAY_KEY);
  if (raw === null) return true;
  return raw !== '0';
}

export function setStationAutoplayEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STATION_AUTOPLAY_KEY, enabled ? '1' : '0');
}
