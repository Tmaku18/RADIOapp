export const GUEST_STORAGE_KEY = 'networx_guest';

export function isGuestBrowse(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(GUEST_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function startGuestBrowse(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(GUEST_STORAGE_KEY, '1');
  } catch {
    // Private mode can block storage; navigation still proceeds.
  }
}

export function clearGuestBrowse(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
