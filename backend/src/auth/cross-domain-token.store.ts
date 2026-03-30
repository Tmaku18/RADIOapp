/**
 * In-memory store for one-time cross-domain login tokens.
 * Key: token string, Value: { idToken, targetHost, exp }
 */
const store = new Map<
  string,
  { idToken: string; targetHost: string; exp: number }
>();

const TTL_SEC = 120;

export function setCrossDomainToken(
  token: string,
  idToken: string,
  targetHost: string,
): void {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  store.set(token, { idToken, targetHost, exp });
  setTimeout(() => store.delete(token), TTL_SEC * 1000);
}

export function getAndDeleteCrossDomainToken(
  token: string,
): { idToken: string; targetHost: string } | null {
  const entry = store.get(token);
  store.delete(token);
  if (!entry) return null;
  if (entry.exp < Math.floor(Date.now() / 1000)) return null;
  return { idToken: entry.idToken, targetHost: entry.targetHost };
}

export const ALLOWED_CROSS_DOMAIN_HOSTS = [
  'https://www.networxradio.com',
  'https://networxradio.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://www.pro-networx.com',
  'https://pro-networx.com',
  'https://www.pro-networx.com',
  'https://pro-networx.com',
];

export function isAllowedTargetHost(host: string): boolean {
  const normalized = host.replace(/\/$/, '').toLowerCase();
  return ALLOWED_CROSS_DOMAIN_HOSTS.some((h) => h.toLowerCase() === normalized);
}
