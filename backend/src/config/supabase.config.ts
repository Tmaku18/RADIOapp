import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

let supabaseClient: SupabaseClient;

// Hard ceiling on any single Supabase HTTP call. Without this, a stuck/slow
// PostgREST connection can hang the Node event loop indefinitely, exhaust
// outbound sockets, and starve unrelated public endpoints (e.g. /api/radio/current
// and /api/songs/station-counts). 10s is generous for normal queries while
// still letting the worker recover quickly when the upstream is unhealthy.
const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

function timedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // If the caller already wired their own AbortSignal, respect it but also
  // enforce our deadline by listening to whichever fires first.
  const callerSignal = init?.signal;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('supabase fetch timeout')),
    SUPABASE_FETCH_TIMEOUT_MS,
  );

  const onCallerAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason);
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    callerSignal?.removeEventListener?.('abort', onCallerAbort);
  });
}

export const initializeSupabase = (
  configService: ConfigService,
): SupabaseClient => {
  if (!supabaseClient) {
    const supabaseUrl = configService.get<string>('SUPABASE_URL');
    const supabaseKey = configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Service Key must be provided');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { fetch: timedFetch },
    });
  }
  return supabaseClient;
};

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized');
  }
  return supabaseClient;
};
