import { SupabaseClient } from '@supabase/supabase-js';

/**
 * The `users.username` column is NOT NULL, unique (citext, case-insensitive),
 * and must match ^[a-z0-9_.]{3,30}$. Every code path that inserts a user row
 * must therefore supply a valid, unique handle. This helper derives one from
 * the display name / email (mirroring the SQL backfill in migration 082) and
 * guarantees uniqueness against the live table.
 */

const MAX_LEN = 30;
const MIN_LEN = 3;

/** Strip to allowed chars and trim leading/trailing separators. */
function sanitize(raw: string): string {
  const cleaned = (raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/^[._]+|[._]+$/g, '');
  return cleaned.slice(0, MAX_LEN);
}

/** Build a base handle from the best available seed. */
function deriveBase(seed: {
  displayName?: string | null;
  email?: string | null;
  userId?: string | null;
}): string {
  let base = sanitize(seed.displayName ?? '');
  if (base.length < MIN_LEN) {
    const local = (seed.email ?? '').split('@')[0] ?? '';
    base = sanitize(local);
  }
  if (base.length < MIN_LEN) {
    const idFragment = (seed.userId ?? '').replace(/-/g, '').slice(0, 8);
    base = `user${idFragment}`.slice(0, MAX_LEN);
  }
  if (base.length < MIN_LEN) {
    base = `user${Math.random().toString(36).slice(2, 8)}`;
  }
  return base.slice(0, MAX_LEN);
}

/** Append a suffix while keeping the whole handle within the length limit. */
function withSuffix(base: string, suffix: string): string {
  const room = MAX_LEN - suffix.length - 1;
  const head = base.slice(0, Math.max(MIN_LEN, room));
  return `${head}_${suffix}`;
}

async function isFree(
  supabase: SupabaseClient,
  username: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  // PGRST116 = no rows; anything else we treat conservatively as "not free"
  // so we keep trying other candidates rather than risk a collision.
  if (error && error.code !== 'PGRST116') {
    return false;
  }
  return !data;
}

/**
 * Returns a unique, validation-compliant username. Tries the base handle, then
 * numbered variants, then random suffixes, and finally a timestamp-based handle
 * as a last resort. Uniqueness is best-effort against races; callers that insert
 * should still tolerate a unique-violation and retry.
 */
export async function generateUniqueUsername(
  supabase: SupabaseClient,
  seed: {
    displayName?: string | null;
    email?: string | null;
    userId?: string | null;
  },
): Promise<string> {
  const base = deriveBase(seed);

  if (await isFree(supabase, base)) {
    return base;
  }

  for (let i = 1; i <= 5; i += 1) {
    const candidate = withSuffix(base, String(i));
    if (await isFree(supabase, candidate)) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rand = Math.random().toString(36).slice(2, 7);
    const candidate = withSuffix(base, rand);
    if (await isFree(supabase, candidate)) {
      return candidate;
    }
  }

  return `user${Date.now().toString(36)}`.slice(0, MAX_LEN);
}
