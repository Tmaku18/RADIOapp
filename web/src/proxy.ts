import { NextRequest, NextResponse } from 'next/server';

const REF_COOKIE = 'networx_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const DISCOVERME_HOSTS = ['discovermeradio.com', 'www.discovermeradio.com'];
const NETWORXRADIO_HOSTS = ['networxradio.com', 'www.networxradio.com'];
const PRO_NETWORX_DOMAIN = (
  process.env.NEXT_PUBLIC_PRO_NETWORX_APP_URL || 'https://pro.discovermeradio.com'
)
  .trim()
  .replace(/\/$/, '');

function mapProNetworxPath(pathname: string): string {
  if (pathname === '/pro-networx' || pathname === '/pro-networx/') return '/';
  if (pathname === '/pro-networx/directory') return '/directory';
  if (pathname === '/pro-networx/feed') return '/discover';
  if (pathname === '/pro-networx/onboarding') return '/onboarding';
  if (pathname.startsWith('/pro-networx/u/')) {
    return pathname.replace('/pro-networx', '');
  }
  if (pathname.startsWith('/pro-networx/')) {
    return pathname.replace('/pro-networx', '') || '/';
  }
  if (pathname === '/job-board' || pathname.startsWith('/job-board/')) {
    return '/directory';
  }
  if (
    pathname === '/artist/services' ||
    pathname.startsWith('/artist/services/')
  ) {
    return '/directory';
  }
  return '/directory';
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hostname = request.nextUrl.hostname?.toLowerCase() ?? '';

  const isNetworxDomain = NETWORXRADIO_HOSTS.some((h) => hostname === h);
  const isProNetworxRoute =
    pathname === '/pro-networx' ||
    pathname.startsWith('/pro-networx/') ||
    pathname === '/job-board' ||
    pathname.startsWith('/job-board/') ||
    pathname === '/artist/services' ||
    pathname.startsWith('/artist/services/');

  // ProNetworx/Catalyst pages are served by dedicated Pro app domain.
  if (isProNetworxRoute) {
    const proUrl = new URL(mapProNetworxPath(pathname) + request.nextUrl.search, PRO_NETWORX_DOMAIN);
    if (isNetworxDomain || DISCOVERME_HOSTS.some((h) => hostname === h)) {
      return NextResponse.redirect(proUrl, 302);
    }
  }

  // Discover Me Radio domain: root resolves to dedicated Pro app.
  if (DISCOVERME_HOSTS.some((h) => hostname === h) && (pathname === '/' || pathname === '')) {
    const proNetworxUrl = new URL('/directory', PRO_NETWORX_DOMAIN);
    return NextResponse.redirect(proNetworxUrl);
  }

  // On discovermeradio.com, dashboard should route to dedicated Pro app.
  if (DISCOVERME_HOSTS.some((h) => hostname === h) && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    const proNetworxAppUrl = new URL('/directory', PRO_NETWORX_DOMAIN);
    return NextResponse.redirect(proNetworxAppUrl, 302);
  }

  // On discovermeradio.com, profile routes to dedicated Pro app profile.
  if (DISCOVERME_HOSTS.some((h) => hostname === h) && (pathname === '/profile' || pathname.startsWith('/profile/'))) {
    const proNetworxProfileUrl = new URL('/onboarding', PRO_NETWORX_DOMAIN);
    return NextResponse.redirect(proNetworxProfileUrl, 302);
  }

  const res = NextResponse.next();

  // Referral: store ref query param in cookie for sign-up association
  const ref = searchParams.get('ref');
  if (ref && typeof ref === 'string' && ref.length > 0 && ref.length <= 128) {
    res.cookies.set(REF_COOKIE, ref, { path: '/', maxAge: REF_MAX_AGE, sameSite: 'lax', httpOnly: true });
  }

  // /artist/* and /job-board: allow all (single user type; auth enforced by dashboard layout and backend)
  // No redirect to /apply; all logged-in users have full access.
  return res;
}

export const config = {
  matcher: [
    '/artist/:path*',
    '/job-board',
    '/',
    '/dashboard',
    '/dashboard/:path*',
    '/profile',
    '/profile/:path*',
    '/signup',
    '/login',
    '/pro-directory',
    '/pro-networx',
    '/pro-networx/:path*',
    '/auth-handoff',
    '/cross-domain-login',
  ],
};
