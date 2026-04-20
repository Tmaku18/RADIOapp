import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

/**
 * Direct Postgres connection pool that bypasses PostgREST.
 * Used for critical read paths (radio) where PostgREST schema cache
 * failures would otherwise block the entire API.
 *
 * Requires DATABASE_URL env var (Supabase pooler connection string).
 * Falls back gracefully if not configured.
 */
export function getDirectPool(): Pool | null {
  if (pool) return pool;

  const url = process.env.DATABASE_URL;
  if (!url) return null;

  pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    ssl: { rejectUnauthorized: false },
  });

  pool.on('error', (err) => {
    console.error('[DirectPool] Unexpected pool error:', err.message);
  });

  return pool;
}

export async function directQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const p = getDirectPool();
  if (!p) throw new Error('DATABASE_URL not configured');
  const result = await p.query(sql, params);
  return result.rows as T[];
}
