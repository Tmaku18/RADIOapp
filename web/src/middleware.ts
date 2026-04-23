import { NextRequest, NextResponse } from 'next/server';

const REF_COOKIE = 'networx_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const PRO_NETWORX_HOSTS = ['pro-networx.com', 'www.pro-networx.com'];
const NETWORXRADIO_HOSTS = ['networxradio.com', 'www.networxradio.com'];
function getProNetworxOrigin(): string {
  const raw = (
    process.env.NEXT_PUBLIC_PRO_NETWORX_APP_URL || 'https://www.pro-networx.com'
  )
    .trim()
    .replace(/\/$/, '');
  try {
    const url = new URL(
      raw.startsWith('http://') || raw.startsWith('https://')
        ? raw
        : `https://${raw}`,
    );
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://www.pro-networx.com';
  }
}

const PRO_NETWORX_DOMAIN = getProNetworxOrigin();

function mapProNetworxPath(pathname: string): string {
  if (pathname === '/pro-networx' || pathname === '/pro-networx/')
    return '/pro-networx/directory';
  if (pathname === '/pro-networx/directory')
    return '/pro-networx/directory';
  if (pathname === '/pro-networx/feed')
    return '/pro-networx/feed';
  if (pathname === '/pro-networx/onboarding')
    return '/pro-networx/onboarding';
  if (pathname.startsWith('/pro-networx/u/')) return pathname;
  if (pathname.startsWith('/pro-networx/')) {
    return pathname;
  }
  if (pathname === '/job-board' || pathname.startsWith('/job-board/')) {
    return '/pro-networx/directory';
  }
  if (
    pathname === '/artist/services' ||
    pathname.startsWith('/artist/services/')
  ) {
    return '/pro-networx/directory';
  }
  return '/pro-networx/directory';
}

export function middleware(request: NextRequest) {
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

  if (isProNetworxRoute) {
    const targetPath = mapProNetworxPath(pathname) + request.nextUrl.search;
    const proUrl = new URL(targetPath, PRO_NETWORX_DOMAIN);
    if (
      isNetworxDomain ||
      (PRO_NETWORX_HOSTS.some((h) => hostname === h) &&
        `${request.nextUrl.pathname}${request.nextUrl.search}` !== targetPath)
    ) {
      return NextResponse.redirect(proUrl, 302);
    }
  }

  if (PRO_NETWORX_HOSTS.some((h) => hostname === h) && (pathname === '/' || pathname === '')) {
    const proNetworxUrl = new URL(
      mapProNetworxPath('/pro-networx/directory'),
      PRO_NETWORX_DOMAIN,
    );
    return NextResponse.redirect(proNetworxUrl, 302);
  }

  if (PRO_NETWORX_HOSTS.some((h) => hostname === h) && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    const proNetworxAppUrl = new URL(
      mapProNetworxPath('/pro-networx/directory'),
      PRO_NETWORX_DOMAIN,
    );
    return NextResponse.redirect(proNetworxAppUrl, 302);
  }

  if (PRO_NETWORX_HOSTS.some((h) => hostname === h) && (pathname === '/profile' || pathname.startsWith('/profile/'))) {
    const proNetworxProfileUrl = new URL(
      mapProNetworxPath('/pro-networx/onboarding'),
      PRO_NETWORX_DOMAIN,
    );
    return NextResponse.redirect(proNetworxProfileUrl, 302);
  }

  const res = NextResponse.next();

  const ref = searchParams.get('ref');
  if (ref && typeof ref === 'string' && ref.length > 0 && ref.length <= 128) {
    res.cookies.set(REF_COOKIE, ref, { path: '/', maxAge: REF_MAX_AGE, sameSite: 'lax', httpOnly: true });
  }

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
