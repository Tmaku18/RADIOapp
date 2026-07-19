import { Pool } from 'pg';

let pool: Pool | null = null;

let circuitOpen = false;
let circuitOpenUntil = 0;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
let consecutiveFailures = 0;
const CIRCUIT_FAILURE_THRESHOLD = 3;

/**
 * Direct Postgres connection pool that bypasses PostgREST.
 * Includes a local circuit breaker: after repeated auth/connection
 * failures the pool is disabled for CIRCUIT_COOLDOWN_MS so the app
 * falls through to PostgREST instead of hammering a broken pooler.
 */
export function getDirectPool(): Pool | null {
  if (circuitOpen) {
    if (Date.now() < circuitOpenUntil) return null;
    circuitOpen = false;
    consecutiveFailures = 0;
    console.log('[DirectPool] Circuit breaker reset — retrying direct connections');
  }

  if (pool) return pool;

  const url = process.env.DATABASE_URL;
  if (!url) return null;

  pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    ssl: { rejectUnauthorized: false },
  });

  pool.on('error', (err) => {
    console.error('[DirectPool] Unexpected pool error:', err.message);
    recordDirectFailure(err);
  });

  return pool;
}

function recordDirectFailure(err: unknown) {
  consecutiveFailures++;
  const msg = err instanceof Error ? err.message : String(err);
  if (
    consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD ||
    msg.includes('ECIRCUITBREAKER')
  ) {
    circuitOpen = true;
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    console.warn(
      `[DirectPool] Circuit breaker OPEN for ${CIRCUIT_COOLDOWN_MS / 1000}s ` +
        `after ${consecutiveFailures} failures (last: ${msg})`,
    );
    if (pool) {
      pool.end().catch(() => {});
      pool = null;
    }
  }
}

export function recordDirectSuccess() {
  consecutiveFailures = 0;
}

export async function directQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const p = getDirectPool();
  if (!p) throw new Error('DATABASE_URL not configured or circuit open');
  try {
    const result = await p.query(sql, params);
    recordDirectSuccess();
    return result.rows as T[];
  } catch (err) {
    recordDirectFailure(err);
    throw err;
  }
}
