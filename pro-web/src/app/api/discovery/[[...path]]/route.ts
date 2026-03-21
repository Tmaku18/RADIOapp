import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function getBackendBaseUrls(): string[] {
  const candidates = [
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    'http://localhost:3000',
  ].filter((value): value is string => !!value && value.trim().length > 0);

  const normalized: string[] = [];
  for (const candidate of candidates) {
    const url = normalizeBaseUrl(candidate);
    if (!normalized.includes(url)) normalized.push(url);
  }
  return normalized;
}

/**
 * Proxy all /api/discovery/* requests to backend.
 * Uses multipart streaming so feed video uploads avoid proxy body-size caps.
 */
async function proxy(request: NextRequest, pathSegments: string[]) {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  const search = request.nextUrl.search || '';
  const auth = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = auth;
  if (contentType) headers['Content-Type'] = contentType;

  let body: string | ReadableStream<Uint8Array> | undefined;
  let isMultipartStream = false;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const ct = (contentType || '').toLowerCase();
      if (ct.includes('multipart')) {
        body = request.body ?? undefined;
        isMultipartStream = true;
      } else {
        body = await request.text();
      }
    } catch {
      // No body
    }
    if (body && !contentType && typeof body === 'string') {
      headers['Content-Type'] = 'application/json';
    }
  }

  const apiBases = getBackendBaseUrls().map((base) =>
    base.endsWith('/api') ? base : `${base}/api`,
  );

  let res: Response | null = null;
  let lastError: unknown = null;
  for (const apiBase of apiBases) {
    const url = `${apiBase}/discovery${path ? `/${path}` : ''}${search}`;
    try {
      const init: RequestInit & { duplex?: 'half' } = {
        method: request.method,
        headers,
        body: body ?? undefined,
      };
      if (isMultipartStream && body) {
        init.duplex = 'half';
      }
      res = await fetch(url, init);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!res) {
    const details = lastError instanceof Error ? ` (${lastError.message})` : '';
    return NextResponse.json(
      {
        message: `Backend unreachable across configured URLs. Check BACKEND_URL/NEXT_PUBLIC_API_URL and backend health.${details}`.trim(),
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
      {
        message:
          (data as { message?: string }).message ??
          'Endpoint not found. Ensure the backend is deployed and BACKEND_URL is set.',
      },
      { status: 404 },
    );
  }

  if (res.status >= 500 && !(data as { message?: string }).message) {
    return NextResponse.json(
      { message: 'Backend returned a server error. Please try again shortly.' },
      { status: res.status },
    );
  }

  return NextResponse.json(data, { status: res.status });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path ?? []);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path ?? []);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path ?? []);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path ?? []);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path ?? []);
}
