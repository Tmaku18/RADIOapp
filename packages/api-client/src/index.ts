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

export type ApiModule = (typeof API_MODULE_PREFIXES)[number];

export const API_BASE_PATH = '/api';

export function apiPath(module: ApiModule, ...segments: string[]): string {
  const tail = segments.filter(Boolean).join('/');
  return tail ? `${API_BASE_PATH}/${module}/${tail}` : `${API_BASE_PATH}/${module}`;
}
