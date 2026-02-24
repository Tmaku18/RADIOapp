import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    // Clear the session cookie
    cookieStore.delete('session');

    // Optionally revoke the session on Firebase side
    if (sessionCookie) {
      try {
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
        await adminAuth.revokeRefreshTokens(decodedClaims.uid);
      } catch {
        // Session cookie might be invalid, but we still clear it
        console.log('Session cookie was invalid or already revoked');
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session logout error:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}
