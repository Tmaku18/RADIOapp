const STATION_AUTOPLAY_KEY = 'networx-station-autoplay';

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
