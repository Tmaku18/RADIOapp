import { NextRequest, NextResponse } from 'next/server';

/**
 * Exchange a one-time cross-domain token for a session cookie on this origin.
 * Called when user arrives from discovermeradio.com (or other domain) with ?token=xxx.
 * Backend returns session cookie; we set it for the current origin so the user is logged in here.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body?.token;
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const origin =
      request.headers.get('origin') ||
      request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
      request.nextUrl.origin;
    const currentHost = origin.replace(/\/$/, '');

    const backendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3005';
    const base = backendUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/api/auth/cross-domain-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, currentHost }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || 'Invalid or expired token' },
        { status: res.status }
      );
    }

    const { sessionCookie, maxAge } = data;
    if (!sessionCookie || !maxAge) {
      return NextResponse.json(
        { error: 'Invalid response from auth' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Number(maxAge) || 60 * 60 * 24 * 5,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Cross-domain exchange error:', error);
    return NextResponse.json(
      { error: 'Failed to complete sign-in' },
      { status: 500 }
    );
  }
}
