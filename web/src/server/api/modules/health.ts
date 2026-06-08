import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@radioapp/db';

export async function healthHandler(
  _request: NextRequest,
  pathSegments: string[],
): Promise<Response | null> {
  if (pathSegments.length !== 1 || pathSegments[0] !== 'health') {
    return null;
  }

  const startedAt = Date.now();
  let ok = false;
  let error: string | null = null;

  try {
    const supabase = getServiceSupabase();
    const result = await supabase
      .from('songs')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    if (result.error) {
      error = result.error.message;
    } else {
      ok = true;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const latencyMs = Date.now() - startedAt;

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime?.() ?? 0),
      supabase: { ok, latencyMs: ok || error ? latencyMs : null, error },
      timestamp: new Date().toISOString(),
      strangler: 'local',
    },
    { status: 200 },
  );
}
