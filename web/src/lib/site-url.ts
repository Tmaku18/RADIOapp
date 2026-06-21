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

/** Default in-app landing after Pro-Networx sign-in (Discover Catalysts). */
export const PRO_NETWORX_APP_HOME = '/pro-networx/home';

export function isProNetworxAppHost(hostname?: string): boolean {
  const host =
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  return host === 'pro-networx.com' || host === 'www.pro-networx.com';
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
  '/child-safety',
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
  '/job-board',
  '/directory',
  '/api',
] as const;

/**
 * Auth-gated subroutes inside the /pro-networx tree. Public landing/directory
 * pages on pro-networx.com remain indexable; everything here stays out of
 * Google's index regardless of host.
 */
export const NOINDEX_PRO_NETWORX_SUBPATHS = [
  '/pro-networx/home',
  '/pro-networx/me',
  '/pro-networx/messages',
  '/pro-networx/notifications',
  '/pro-networx/onboarding',
  '/pro-networx/search',
  '/pro-networx/explore',
  '/pro-networx/feed',
  '/pro-networx/radio',
] as const;

/**
 * Public, indexable canonical paths served on the pro-networx.com host. These
 * end up in pro-networx.com/sitemap.xml and are NOT disallowed in robots.txt
 * for that host.
 */
export const PUBLIC_PRO_NETWORX_PATHS = [
  '/pro-networx',
  '/pro-networx/directory',
] as const;

export function shouldNoIndexPath(pathname: string): boolean {
  if (
    NOINDEX_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }
  return NOINDEX_PRO_NETWORX_SUBPATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
