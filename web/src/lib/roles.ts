/**
 * Role hierarchy: listener ← artist ← service_provider (producer).
 * People can hold Artist, Producer, Instrumentalist, and DJ at the same time.
 * `users.role` stays the first of those, or listener. Admin stays admin.
 * Upload is available to every maker role, including Instrumentalist.
 */

export type AppRole =
  | 'listener'
  | 'artist'
  | 'admin'
  | 'service_provider'
  | 'dj'
  | 'musician';

export type RoleSource =
  | AppRole
  | string
  | null
  | undefined
  | { role?: string | null; userRoles?: string[] | null };

const MAKER_ROLES = ['artist', 'service_provider', 'musician', 'dj'] as const;

function heldRoles(input: RoleSource): Set<string> {
  if (input && typeof input === 'object') {
    const roles = new Set<string>();
    if (input.role) roles.add(input.role);
    for (const role of input.userRoles ?? []) roles.add(role);
    return roles;
  }
  return new Set(input ? [input] : []);
}

/** User has Prospector (listener) capabilities: listen, vote, follow, yield, refinery. */
export function hasListenerCapability(role: AppRole | null | undefined): boolean {
  if (!role) return false;
  return ['listener', 'artist', 'service_provider', 'admin', 'dj', 'musician'].includes(role);
}

/** User can host a Live DJ broadcast (DJ role, or admin acting as DJ). */
export function hasDjCapability(input: RoleSource): boolean {
  const roles = heldRoles(input);
  return roles.has('dj') || roles.has('admin');
}

/** User can host a Live Performance (instrumentalist, or admin). */
export function hasMusicianCapability(input: RoleSource): boolean {
  const roles = heldRoles(input);
  return roles.has('musician') || roles.has('admin');
}

/** Upload / studio capability: everyone except listeners. */
export function hasArtistCapability(input: RoleSource): boolean {
  const roles = heldRoles(input);
  if (roles.size === 0) return false;
  if (roles.has('admin')) return true;
  return MAKER_ROLES.some((role) => roles.has(role));
}

/** Producer (service provider) capabilities: offer services, ProNetworx. */
export function hasServiceProviderCapability(input: RoleSource): boolean {
  const roles = heldRoles(input);
  return roles.has('service_provider') || roles.has('admin');
}

export const MAKER_ROLE_OPTIONS = [
  { id: 'artist', label: 'Artist' },
  { id: 'service_provider', label: 'Producer' },
  { id: 'musician', label: 'Instrumentalist' },
  { id: 'dj', label: 'DJ' },
] as const;

export function makerRolesFromProfile(profile?: {
  role?: string | null;
  userRoles?: string[] | null;
} | null): string[] {
  const fromList = (profile?.userRoles ?? []).filter((role) =>
    MAKER_ROLES.includes(role as (typeof MAKER_ROLES)[number]),
  );
  if (fromList.length > 0) return fromList;
  if (profile?.role && MAKER_ROLES.includes(profile.role as (typeof MAKER_ROLES)[number])) {
    return [profile.role];
  }
  return [];
}

export function primaryMakerRole(
  roles: readonly string[],
): Exclude<AppRole, 'admin'> {
  for (const role of MAKER_ROLES) {
    if (roles.includes(role)) return role;
  }
  return 'listener';
}

/** User-facing role label. DB values stay `artist` / `service_provider` / `musician`. */
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
      return 'Instrumentalist';
    case 'listener':
    default:
      return 'Listener';
  }
}
