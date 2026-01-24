import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 Proxy - handles routing operations only
 * Authentication is now handled in layout components (Server Layout Guards)
 */
export async function proxy(request: NextRequest) {
  // Proxy is for rewrites, redirects, and headers only
  // Auth checks moved to dashboard layout
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
