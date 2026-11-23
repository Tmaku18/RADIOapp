'use client';

import { auth } from '@/lib/firebase-client';
import { clearGuestBrowse } from '@/lib/guest';

export function hasAccount(): boolean {
  try {
    return !!auth?.currentUser;
  } catch {
    return false;
  }
}

/** Sends guests to login. Returns true when an account is already signed in. */
export function requireAccount(redirectPath?: string): boolean {
  if (hasAccount()) {
    clearGuestBrowse();
    return true;
  }
  if (typeof window === 'undefined') return false;
  const path =
    redirectPath ||
    `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?redirect=${encodeURIComponent(path)}`);
  return false;
}
