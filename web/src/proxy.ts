import { NextRequest, NextResponse } from 'next/server';

const REF_COOKIE = 'networx_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const DISCOVERME_HOSTS = ['discovermeradio.com', 'www.discovermeradio.com'];
const NETWORXRADIO_HOSTS = ['networxradio.com', 'www.networxradio.com'];
const PRO_NETWORX_DOMAIN = 'https://www.discovermeradio.com';
const PRO_NETWORX_REDIRECT_PATH = '/pro-networx/directory';

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

  // ProNetworx/Catalyst pages are discovermeradio.com-only.
  if (isNetworxDomain && isProNetworxRoute) {
    const discoverMeUrl = new URL(PRO_NETWORX_REDIRECT_PATH + request.nextUrl.search, PRO_NETWORX_DOMAIN);
    return NextResponse.redirect(discoverMeUrl, 302);
  }

  // Discover Me Radio domain: send root to ProNetworx (separate site experience from networxradio.com)
  if (DISCOVERME_HOSTS.some((h) => hostname === h) && (pathname === '/' || pathname === '')) {
    const proNetworxUrl = new URL('/pro-networx', request.url);
    return NextResponse.redirect(proNetworxUrl);
  }

  // On discovermeradio.com, dashboard is the main Networx app; send to ProNetworx (LinkedIn®/Fiverr-style) instead
  if (DISCOVERME_HOSTS.some((h) => hostname === h) && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    const proNetworxAppUrl = new URL('/pro-networx/directory', request.url);
    return NextResponse.redirect(proNetworxAppUrl, 302);
  }

  // Radio profile (account type, member since, etc.) is networxradio.com only; on discovermeradio.com use ProNetworx profile
  if (DISCOVERME_HOSTS.some((h) => hostname === h) && (pathname === '/profile' || pathname.startsWith('/profile/'))) {
    const proNetworxProfileUrl = new URL('/pro-networx/onboarding', request.url);
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
