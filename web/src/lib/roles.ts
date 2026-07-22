/**
 * Role hierarchy: listener ← artist ← service_provider (producer).
 * - Listener: listen, ripple, follow, yield, refinery.
 * - Artist+: everything listener + upload, credits, The Wake, live.
 * - Producer (service_provider): everything artist + offer Pro-Networx services.
 * Upload is available to every role except listener (includes dj / musician / admin).
 */

export type AppRole =
  | 'listener'
  | 'artist'
  | 'admin'
  | 'service_provider'
  | 'dj'
  | 'musician';

/** User has Prospector (listener) capabilities: listen, vote, follow, yield, refinery. */
export function hasListenerCapability(role: AppRole | null | undefined): boolean {
  if (!role) return false;
  return ['listener', 'artist', 'service_provider', 'admin', 'dj', 'musician'].includes(role);
}

/** User can host a Live DJ broadcast (DJ role, or admin acting as DJ). */
export function hasDjCapability(role: AppRole | null | undefined): boolean {
  if (!role) return false;
  return role === 'dj' || role === 'admin';
}

/** User can host a Live Performance (musician role, or admin acting as musician). */
export function hasMusicianCapability(role: AppRole | null | undefined): boolean {
  if (!role) return false;
  return role === 'musician' || role === 'admin';
}

/** Upload / studio capability: everyone except listeners. */
export function hasArtistCapability(role: AppRole | null | undefined): boolean {
  if (!role) return false;
  return role !== 'listener';
}

/** Producer (service provider) capabilities: offer services, ProNetworx. */
export function hasServiceProviderCapability(role: AppRole | null | undefined): boolean {
  if (!role) return false;
  return role === 'service_provider' || role === 'admin';
}

/** User-facing role label. DB values stay `artist` / `service_provider`. */
export function roleDisplayLabel(role: AppRole | string | null | undefined): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'service_provider':
      return 'Producer';
    case 'artist':
      return 'Artist';
    case 'dj':
      return 'DJ';
    case 'musician':
      return 'Musician';
    case 'listener':
    default:
      return 'Listener';
  }
}
