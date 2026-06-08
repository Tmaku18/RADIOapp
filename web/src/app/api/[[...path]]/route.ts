import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { RouteHandlerContext } from '@/server/api/types';
import { dispatchLocalApi } from '@/server/api/router';

export const runtime = 'nodejs';

type Params = { path?: string[] };

async function handle(request: NextRequest, pathSegments: string[]) {
  const local = await dispatchLocalApi(request, pathSegments);
  if (local) return local;
  const { proxyToLegacyBackend } = await import('@/lib/strangler/legacy-proxy');
  return proxyToLegacyBackend(request, pathSegments);
}

export async function GET(request: NextRequest, ctx: RouteHandlerContext<Params>) {
  const { path } = await ctx.params;
  return handle(request, path ?? []);
}

export async function POST(request: NextRequest, ctx: RouteHandlerContext<Params>) {
  const { path } = await ctx.params;
  return handle(request, path ?? []);
}

export async function PUT(request: NextRequest, ctx: RouteHandlerContext<Params>) {
  const { path } = await ctx.params;
  return handle(request, path ?? []);
}

export async function PATCH(request: NextRequest, ctx: RouteHandlerContext<Params>) {
  const { path } = await ctx.params;
  return handle(request, path ?? []);
}

export async function DELETE(request: NextRequest, ctx: RouteHandlerContext<Params>) {
  const { path } = await ctx.params;
  return handle(request, path ?? []);
}
