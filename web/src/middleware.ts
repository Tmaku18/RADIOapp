import { NextRequest, NextResponse } from 'next/server';

/** Roles with Gem (artist) capability: artist, Catalyst (service_provider), admin. */
const ARTIST_ROLES = ['artist', 'admin', 'service_provider'];
const APPLY_PATH = '/apply';
const REF_COOKIE = 'networx_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const DISCOVERME_HOSTS = ['discovermeradio.com', 'www.discovermeradio.com'];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hostname = request.nextUrl.hostname?.toLowerCase() ?? '';

  // Discover Me Radio domain: send root to Pro-Network (job-board) instead of same home as Networx
  if (DISCOVERME_HOSTS.some((h) => hostname === h) && (pathname === '/' || pathname === '')) {
    const jobBoardUrl = new URL('/job-board', request.url);
    return NextResponse.redirect(jobBoardUrl);
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
  matcher: ['/artist/:path*', '/job-board', '/', '/signup', '/login', '/pro-directory', '/pro-networx', '/pro-networx/:path*'],
};
