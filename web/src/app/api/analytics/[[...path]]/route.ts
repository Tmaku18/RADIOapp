import { NextRequest, NextResponse } from 'next/server';
import { getBackendBaseUrls } from '@/lib/backend-url';

export const runtime = 'nodejs';

/**
 * Proxy all /api/analytics/* requests to the backend.
 *
 * Critically forwards the Authorization header so authenticated endpoints
 * (/analytics/me, /me/roi, /me/plays-by-region, /me/discover-swipes,
 * /analytics/profile-click) resolve the current user. Without it the backend
 * RolesGuard rejects the request and the artist stats page renders all zeros.
 */
async function proxy(request: NextRequest, pathSegments: string[]) {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  const search = request.nextUrl.search || '';
  const auth = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth) headers.Authorization = auth;
  if (contentType) headers['Content-Type'] = contentType;

  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.text();
    } catch {
      // No request body
    }
    if (body && !contentType) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const apiBases = getBackendBaseUrls().map((base) =>
    base.endsWith('/api') ? base : `${base}/api`,
  );

  let res: Response | null = null;
  let lastError: unknown = null;
  for (const apiBase of apiBases) {
    const url = `${apiBase}/analytics${path ? `/${path}` : ''}${search}`;
    try {
      res = await fetch(url, {
        method: request.method,
        headers,
        body: body ?? undefined,
        cache: 'no-store',
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!res) {
    const details =
      lastError instanceof Error ? ` (${lastError.message})` : '';
    return NextResponse.json(
      {
        message: `Backend unreachable for analytics proxy.${details}`.trim(),
      },
      { status: 502 },
    );
  }

  const rawBody = await res.text();
  return new NextResponse(rawBody, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}
