// Supabase Edge Function: scheduled cleanup (replaces NestJS cleanup.service cron).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const results: Record<string, unknown> = { timestamp: new Date().toISOString() };

  // 48h rejected song cleanup (delegates to existing RPC if present).
  const { data: rejected, error: rejectedErr } = await supabase.rpc(
    'cleanup_rejected_songs_48h',
  ).maybeSingle();
  results.rejectedSongs = rejectedErr ? { error: rejectedErr.message } : rejected ?? 'skipped';

  // 24h chat archival placeholder.
  results.chatArchive = 'scheduled';

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
});
