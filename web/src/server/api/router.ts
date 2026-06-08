import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { shouldHandleLocally } from '@/lib/strangler/config';
import { MODULE_HANDLERS } from './modules';

/**
 * If this module is flagged local, run its handler; otherwise return null
 * so the caller can proxy to legacy NestJS.
 */
export async function dispatchLocalApi(
  request: NextRequest,
  pathSegments: string[],
): Promise<Response | null> {
  const segmentsForCheck =
    pathSegments.length === 0 ? ['health'] : pathSegments;
  if (!shouldHandleLocally(segmentsForCheck)) {
    return null;
  }

  const moduleKey = segmentsForCheck[0].toLowerCase();
  const handler = MODULE_HANDLERS[moduleKey];
  if (!handler) {
    return NextResponse.json(
      {
        message: `Unknown API module "${moduleKey}".`,
        strangler: 'unknown-module',
      },
      { status: 404 },
    );
  }

  const result = await handler(request, pathSegments);
  if (result) return result;

  // Ported module but sub-route not implemented — fall back to legacy NestJS.
  const { proxyToLegacyBackend } = await import('@/lib/strangler/legacy-proxy');
  return proxyToLegacyBackend(request, pathSegments);
}
