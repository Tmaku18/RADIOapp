import { NextRequest, NextResponse } from 'next/server';
import { getBackendBaseUrls } from '@/lib/backend-url';

/**
 * Proxy all /api/songs/* requests to the backend so upload and song endpoints
 * are reliably reached in production.
 */
async function proxy(request: NextRequest, pathSegments: string[]) {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  const search = request.nextUrl.search || '';
  const auth = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  const headers: Record<string, string> = {};
  if (auth) headers['Authorization'] = auth;
  if (contentType) headers['Content-Type'] = contentType;

  let body: string | ArrayBuffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const ct = (contentType || '').toLowerCase();
      body = ct.includes('multipart') ? await request.arrayBuffer() : await request.text();
    } catch {
      // no body
    }
    if (body && !contentType && typeof body === 'string') headers['Content-Type'] = 'application/json';
  }

  const apiBases = getBackendBaseUrls().map((base) =>
    base.endsWith('/api') ? base : `${base}/api`,
  );

  let res: Response | null = null;
  let lastError: unknown = null;
  for (const apiBase of apiBases) {
    const url = `${apiBase}/songs${path ? `/${path}` : ''}${search}`;
    try {
      res = await fetch(url, {
        method: request.method,
        headers,
        body: body ?? undefined,
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
          `Backend unreachable across configured URLs. Check BACKEND_URL/NEXT_PUBLIC_API_URL and backend health.${details}`.trim(),
      },
      { status: 502 },
    );
  }

  const rawBody = await res.text();
  let data: unknown = {};
  if (rawBody.trim().length > 0) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = { message: rawBody };
    }
  }
  if (res.status === 404) {
    return NextResponse.json(
      { message: (data as { message?: string }).message ?? 'Endpoint not found. Ensure the backend is deployed and BACKEND_URL is set.' },
      { status: 404 }
    );
  }

  if (
    res.status >= 500 &&
    !(data as { message?: string }).message
  ) {
    return NextResponse.json(
      { message: 'Backend returned a server error. Please try again shortly.' },
      { status: res.status },
    );
  }

  return NextResponse.json(data, { status: res.status });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params;
  return proxy(_request, path ?? []);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params;
  return proxy(request, path ?? []);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params;
  return proxy(request, path ?? []);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params;
  return proxy(request, path ?? []);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params;
  return proxy(request, path ?? []);
}
