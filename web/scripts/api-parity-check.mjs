#!/usr/bin/env node
/**
 * Compare local strangler /api/health vs legacy backend /api/health.
 * Usage: node scripts/api-parity-check.mjs [baseUrl]
 */
const base = (process.argv[2] ?? 'http://localhost:3001').replace(/\/$/, '');

async function fetchHealth(label, url, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    const body = await res.json();
    return { label, status: res.status, body };
  } catch (err) {
    return { label, error: err instanceof Error ? err.message : String(err) };
  }
}

const local = await fetchHealth('local', `${base}/api/health`);
const legacy = process.env.BACKEND_URL
  ? await fetchHealth(
      'legacy',
      `${process.env.BACKEND_URL.replace(/\/$/, '').replace(/\/api$/, '')}/api/health`,
    )
  : { label: 'legacy', skipped: true };

console.log(JSON.stringify({ local, legacy }, null, 2));

const ok =
  local.body?.status === 'ok' ||
  (local.body?.supabase?.ok && local.status === 200);

process.exit(ok ? 0 : 1);
