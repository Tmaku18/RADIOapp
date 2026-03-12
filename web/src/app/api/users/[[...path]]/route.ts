import { NextRequest, NextResponse } from 'next/server';
import { getBackendBaseUrl } from '@/lib/backend-url';

const base = getBackendBaseUrl();
const apiBase = base.endsWith('/api') ? base : `${base}/api`;

/**
 * Proxy all /api/users/* requests to the backend so role-change and profile endpoints
 * (e.g. POST upgrade-to-artist, POST upgrade-to-catalyst, PUT me) are reliably reached.
 */
async function proxy(request: NextRequest, pathSegments: string[]) {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  const search = request.nextUrl.search || '';
  const url = `${apiBase}/users${path ? `/${path}` : ''}${search}`;
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

  let res: Response;
  try {
    res = await fetch(url, {
      method: request.method,
      headers,
      body: body ?? undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { message: 'Backend unreachable. Check BACKEND_URL and that the API server is running.' },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 404) {
    return NextResponse.json(
      { message: (data as { message?: string }).message ?? 'Endpoint not found. Ensure the backend is deployed and BACKEND_URL is set.' },
      { status: 404 }
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
