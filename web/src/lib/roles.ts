/**
 * Role hierarchy: listener (parent) ← artist (Gem) ← service_provider (Catalyst).
 * - Listener capabilities: listen, ripple, follow, yield, refinery (Prospector).
 * - Artist capabilities: everything listener + upload, credits, The Wake, live (Gem).
 * - Service provider capabilities: everything artist + offer services (Catalyst).
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

/** User has Gem (artist) capabilities: upload, credits, The Wake, live services, artist profile. */
export function hasArtistCapability(role: AppRole | null | undefined): boolean {
  if (!role) return false;
  return ['artist', 'service_provider', 'admin'].includes(role);
}

/** User has Catalyst (service provider) capabilities: offer services, ProNetworx. */
export function hasServiceProviderCapability(role: AppRole | null | undefined): boolean {
  if (!role) return false;
  return role === 'service_provider' || role === 'admin';
}
