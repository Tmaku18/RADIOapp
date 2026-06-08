import { NextRequest, NextResponse } from 'next/server';
import { getBackendBaseUrls } from '@/lib/backend-url';

/**
 * Forward a request to the legacy NestJS backend unchanged.
 */
export async function proxyToLegacyBackend(
  request: NextRequest,
  apiPathSegments: string[],
): Promise<NextResponse> {
  const path = apiPathSegments.join('/');
  const search = request.nextUrl.search || '';
  const auth = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  const stripeSignature = request.headers.get('stripe-signature');

  const headers: Record<string, string> = {};
  if (auth) headers['Authorization'] = auth;
  if (contentType) headers['Content-Type'] = contentType;
  if (stripeSignature) headers['stripe-signature'] = stripeSignature;

  let body: string | ArrayBuffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const ct = (contentType || '').toLowerCase();
      // Webhooks need raw body for signature verification.
      if (stripeSignature || ct.includes('multipart') || path.includes('webhook')) {
        body = await request.arrayBuffer();
      } else {
        body = await request.text();
      }
    } catch {
      // no body
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
    const url = `${apiBase}/${path}${search}`;
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
        message: `Legacy backend unreachable. Check BACKEND_URL/NEXT_PUBLIC_API_URL.${details}`,
        strangler: 'legacy-proxy-failed',
      },
      { status: 502 },
    );
  }

  const resContentType = res.headers.get('content-type') || '';
  if (resContentType.includes('application/json')) {
    const rawBody = await res.text();
    let data: unknown = {};
    if (rawBody.trim().length > 0) {
      try {
        data = JSON.parse(rawBody);
      } catch {
        data = { message: rawBody };
      }
    }
    return NextResponse.json(data, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: res.status,
    headers: { 'Content-Type': resContentType || 'application/octet-stream' },
  });
}
