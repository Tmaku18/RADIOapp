import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveAuthUserFromHeader } from '@radioapp/db';
import {
  getAndDeleteCrossDomainToken,
  isAllowedTargetHost,
  setCrossDomainToken,
} from '@/server/auth/cross-domain-token';
import { getFirebaseAdminAuth } from '@radioapp/db';
import { randomBytes } from 'crypto';

export async function authHandler(
  request: NextRequest,
  pathSegments: string[],
): Promise<Response | null> {
  const sub = pathSegments.slice(1).join('/');
  const method = request.method;

  if (method === 'GET' && sub === 'verify') {
    const user = await resolveAuthUserFromHeader(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({
      uid: user.firebaseUid ?? user.supabaseUid,
      email: user.email,
      emailVerified: user.emailVerified,
      provider: user.provider,
      strangler: 'local',
    });
  }

  if (method === 'POST' && sub === 'cross-domain-token') {
    let body: { idToken?: string; targetHost?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid body' }, { status: 400 });
    }
    if (!body.idToken || !body.targetHost) {
      return NextResponse.json({ message: 'idToken and targetHost required' }, { status: 400 });
    }
    if (!isAllowedTargetHost(body.targetHost)) {
      return NextResponse.json({ message: 'Target host is not allowed' }, { status: 400 });
    }
    const auth = getFirebaseAdminAuth();
    await auth.verifyIdToken(body.idToken);
    const token = randomBytes(32).toString('hex');
    setCrossDomainToken(token, body.idToken, body.targetHost.replace(/\/$/, ''));
    const host = body.targetHost.replace(/\/$/, '');
    return NextResponse.json({
      token,
      redirectUrl: `${host}/cross-domain-login?token=${token}`,
      strangler: 'local',
    });
  }

  if (method === 'POST' && sub === 'cross-domain-exchange') {
    let body: { token?: string; currentHost?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid body' }, { status: 400 });
    }
    if (!body.token || !body.currentHost) {
      return NextResponse.json({ message: 'token and currentHost required' }, { status: 400 });
    }
    const entry = getAndDeleteCrossDomainToken(body.token);
    if (!entry) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 400 });
    }
    const currentHost = body.currentHost.replace(/\/$/, '').toLowerCase();
    const targetHost = entry.targetHost.toLowerCase();
    if (currentHost !== targetHost) {
      return NextResponse.json({ message: 'Current host does not match token target' }, { status: 400 });
    }
    const auth = getFirebaseAdminAuth();
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await auth.createSessionCookie(entry.idToken, { expiresIn });
    let customToken: string | null = null;
    try {
      const decoded = await auth.verifyIdToken(entry.idToken);
      customToken = await auth.createCustomToken(decoded.uid);
    } catch {
      customToken = null;
    }
    return NextResponse.json({
      sessionCookie,
      maxAge: Math.floor(expiresIn / 1000),
      customToken,
      strangler: 'local',
    });
  }

  return null;
}
