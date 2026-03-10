import { NextRequest, NextResponse } from 'next/server';

/** Roles with Gem (artist) capability: artist, Catalyst (service_provider), admin. */
const ARTIST_ROLES = ['artist', 'admin', 'service_provider'];
const APPLY_PATH = '/apply';
const REF_COOKIE = 'networx_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const DISCOVERME_HOSTS = ['discovermeradio.com', 'www.discovermeradio.com'];
const NETWORXRADIO_HOSTS = ['networxradio.com', 'www.networxradio.com'];
const PRO_NETWORX_DOMAIN = 'https://www.discovermeradio.com';

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hostname = request.nextUrl.hostname?.toLowerCase() ?? '';

  // ProNetworx lives on discovermeradio.com only: redirect networxradio.com/pro-networx* to www.discovermeradio.com
  if (NETWORXRADIO_HOSTS.some((h) => hostname === h) && (pathname === '/pro-networx' || pathname.startsWith('/pro-networx/'))) {
    const discoverMeUrl = new URL(pathname + request.nextUrl.search, PRO_NETWORX_DOMAIN);
    return NextResponse.redirect(discoverMeUrl, 302);
  }

  // Discover Me Radio domain: send root to ProNetworx (separate site experience from networxradio.com)
  if (DISCOVERME_HOSTS.some((h) => hostname === h) && (pathname === '/' || pathname === '')) {
    const proNetworxUrl = new URL('/pro-networx', request.url);
    return NextResponse.redirect(proNetworxUrl);
  }

  // On discovermeradio.com, dashboard is the main Networx app; send to ProNetworx (LinkedIn/Fiverr-style) instead
  if (DISCOVERME_HOSTS.some((h) => hostname === h) && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    const proNetworxAppUrl = new URL('/pro-networx/directory', request.url);
    return NextResponse.redirect(proNetworxAppUrl, 302);
  }

  const res = NextResponse.next();

  // Referral: store ref query param in cookie for sign-up association
  const ref = searchParams.get('ref');
  if (ref && typeof ref === 'string' && ref.length > 0 && ref.length <= 128) {
    res.cookies.set(REF_COOKIE, ref, { path: '/', maxAge: REF_MAX_AGE, sameSite: 'lax', httpOnly: true });
  }

  // Protect /artist/* and /job-board: only artist or admin may access
  const isArtistArea = pathname.startsWith('/artist') || pathname === '/job-board';
  if (!isArtistArea) {
    return res;
  }

  const roleCookie = request.cookies.get('user_role')?.value?.toLowerCase();
  const isAllowed = roleCookie && ARTIST_ROLES.includes(roleCookie);

  if (isAllowed) {
    return res;
  }

  const applyUrl = new URL(APPLY_PATH, request.url);
  applyUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(applyUrl);
}

export const config = {
  matcher: [
    '/artist/:path*',
    '/job-board',
    '/',
    '/dashboard',
    '/dashboard/:path*',
    '/signup',
    '/login',
    '/pro-directory',
    '/pro-networx',
    '/pro-networx/:path*',
    '/auth-handoff',
    '/cross-domain-login',
  ],
};
