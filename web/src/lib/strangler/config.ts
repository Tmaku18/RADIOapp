/**
 * Strangler-fig routing: per-module flags decide whether /api/* is served
 * locally (Next.js Route Handlers) or proxied to the legacy NestJS backend.
 *
 * Set STRANGLER_LOCAL_MODULES=health,auth,users (comma-separated path prefixes)
 * or STRANGLER_LOCAL_ALL=true to route everything locally (cutover mode).
 */

/** First path segment after /api/ that maps to a NestJS module. */
export const API_MODULE_PREFIXES = [
  'auth',
  'users',
  'songs',
  'radio',
  'payments',
  'credits',
  'admin',
  'notifications',
  'chat',
  'push-notifications',
  'analytics',
  'suggestions',
  'leaderboard',
  'feed',
  'spotlight',
  'competition',
  'live-services',
  'discovery',
  'creator-network',
  'service-messages',
  'job-board',
  'browse',
  'service-providers',
  'venue-ads',
  'refinery',
  'pro-networx',
  'pro-network-subscription',
  'yield',
  'artist-live',
  'health',
] as const;

export type ApiModulePrefix = (typeof API_MODULE_PREFIXES)[number];

function parseLocalModules(): Set<string> {
  if (process.env.STRANGLER_LOCAL_ALL === 'true') {
    return new Set(API_MODULE_PREFIXES);
  }
  const raw = process.env.STRANGLER_LOCAL_MODULES ?? 'health';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

let cachedLocal: Set<string> | null = null;

export function getLocalModules(): Set<string> {
  if (!cachedLocal) {
    cachedLocal = parseLocalModules();
  }
  return cachedLocal;
}

/** Reset cache (tests). */
export function resetStranglerConfigCache(): void {
  cachedLocal = null;
}

/**
 * Returns the first path segment for an API path like "users/me" -> "users".
 * Empty path (health at /api/health) returns "health" when segment is health.
 */
export function apiModuleFromPath(pathSegments: string[]): string {
  if (pathSegments.length === 0) return '';
  const first = pathSegments[0].toLowerCase();
  if (first === 'health') return 'health';
  return first;
}

export function shouldHandleLocally(pathSegments: string[]): boolean {
  const mod = apiModuleFromPath(pathSegments);
  if (!mod) return false;
  return getLocalModules().has(mod);
}
