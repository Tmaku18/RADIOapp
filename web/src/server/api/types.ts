import type { NextRequest } from 'next/server';

export type RouteHandlerContext<P extends Record<string, unknown>> = {
  params: Promise<P>;
};

export type ApiHandler = (
  request: NextRequest,
  pathSegments: string[],
) => Promise<Response | null>;
