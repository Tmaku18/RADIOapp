import { NextRequest, NextResponse } from 'next/server';
import { getBackendBaseUrls } from '@/lib/backend-url';

async function proxy(request: NextRequest, pathSegments: string[]) {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  const search = request.nextUrl.search || '';
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
        headers: { Accept: 'application/json' },
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
        message:
          `Backend unreachable for analytics proxy.${details}`.trim(),
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
