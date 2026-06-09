/** Canonical public origin for networxradio.com (Search Console property). */
export function getSiteUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.networxradio.com'
  )
    .trim()
    .replace(/\/$/, '');
  try {
    const url = new URL(
      raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`,
    );
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://www.networxradio.com';
  }
}

export function getProNetworxAppUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_PRO_NETWORX_APP_URL || 'https://www.pro-networx.com')
    .trim()
    .replace(/\/$/, '');
  try {
    const url = new URL(
      raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`,
    );
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://www.pro-networx.com';
  }
}

/** Marketing/legal pages that should appear in the sitemap. */
export const PUBLIC_MARKETING_PATHS = [
  '/',
  '/features',
  '/pricing',
  '/about',
  '/faq',
  '/pro-directory',
  '/contact',
  '/privacy',
  '/terms',
  '/legal',
  '/community-guidelines',
  '/copyright-policy',
  '/dmca',
  '/refunds',
  '/delete-account',
] as const;

/** App/authenticated or cross-domain redirect paths — keep out of Google index. */
export const NOINDEX_PATH_PREFIXES = [
  '/login',
  '/signup',
  '/dashboard',
  '/listen',
  '/discover',
  '/browse',
  '/admin',
  '/artist',
  '/settings',
  '/messages',
  '/notifications',
  '/profile',
  '/social',
  '/competition',
  '/refinery',
  '/studio',
  '/watch',
  '/yield',
  '/library',
  '/upload',
  '/payment',
  '/auth-handoff',
  '/cross-domain-login',
  '/pro-networx',
  '/job-board',
  '/directory',
  '/api',
] as const;

export function shouldNoIndexPath(pathname: string): boolean {
  return NOINDEX_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
