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

/** pro-web on www.pro-networx.com uses /directory, /discover, etc. (no /pro-networx prefix). */
function proNetworxUsesStandalonePaths(): boolean {
  try {
    const host = new URL(PRO_NETWORX_DOMAIN).hostname.toLowerCase();
    return host === 'pro-networx.com' || host === 'www.pro-networx.com';
  } catch {
    return false;
  }
}

function mapProNetworxPath(pathname: string): string {
  const standalone = proNetworxUsesStandalonePaths();
  if (pathname === '/pro-networx' || pathname === '/pro-networx/')
    return standalone ? '/' : '/pro-networx';
  if (pathname === '/pro-networx/directory')
    return standalone ? '/' : '/pro-networx/directory';
  if (pathname === '/pro-networx/feed')
    return standalone ? '/discover' : '/pro-networx/feed';
  if (pathname === '/pro-networx/onboarding')
    return standalone ? '/onboarding' : '/pro-networx/onboarding';
  if (pathname.startsWith('/pro-networx/u/')) {
    return standalone
      ? pathname.replace(/^\/pro-networx\/u\//, '/u/')
      : pathname;
  }
  if (pathname.startsWith('/pro-networx/')) {
    return standalone
      ? pathname.replace(/^\/pro-networx/, '') || '/'
      : pathname;
  }
  if (pathname === '/job-board' || pathname.startsWith('/job-board/')) {
    return '/';
  }
  if (
    pathname === '/artist/services' ||
    pathname.startsWith('/artist/services/')
  ) {
    return '/';
  }
  return '/';
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

  // ProNetworx/Catalyst pages: redirect to standalone app (e.g. www.pro-networx.com) or legacy host.
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

  // On pro-networx.com, dashboard routes to ProNetworx root.
  if (PRO_NETWORX_HOSTS.some((h) => hostname === h) && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    const proNetworxAppUrl = new URL(
      '/',
      PRO_NETWORX_DOMAIN,
    );
    return NextResponse.redirect(proNetworxAppUrl, 302);
  }

  // On pro-networx.com, profile routes to ProNetworx profile.
  if (PRO_NETWORX_HOSTS.some((h) => hostname === h) && (pathname === '/profile' || pathname.startsWith('/profile/'))) {
    const proNetworxProfileUrl = new URL(
      mapProNetworxPath('/pro-networx/onboarding'),
      PRO_NETWORX_DOMAIN,
    );
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
