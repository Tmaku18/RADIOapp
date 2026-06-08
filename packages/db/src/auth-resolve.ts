import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from './supabase';

export type AuthProvider = 'supabase' | 'firebase';

export type ResolvedAuthUser = {
  provider: AuthProvider;
  supabaseUid: string | null;
  firebaseUid: string | null;
  email: string | null;
  emailVerified: boolean;
};

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

/**
 * Resolve the caller from Authorization header during the dual-auth migration.
 */
export async function resolveAuthUserFromHeader(
  authHeader: string | null,
): Promise<ResolvedAuthUser | null> {
  const token = extractBearerToken(authHeader);
  if (!token) return null;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnon) {
    try {
      const authClient = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false },
      });
      const { data, error } = await authClient.auth.getUser(token);
      if (!error && data.user) {
        return {
          provider: 'supabase',
          supabaseUid: data.user.id,
          firebaseUid: null,
          email: data.user.email ?? null,
          emailVerified: !!data.user.email_confirmed_at,
        };
      }
    } catch {
      // fall through
    }
  }

  if (process.env.AUTH_FIREBASE_FALLBACK === 'false') return null;

  try {
    const { getFirebaseAdminAuth } = await import('./firebase-admin-lazy');
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const supabase = getServiceSupabase();
    const { data: row } = await supabase
      .from('users')
      .select('id, firebase_uid, email')
      .eq('firebase_uid', decoded.uid)
      .maybeSingle();

    return {
      provider: 'firebase',
      supabaseUid: (row as { id?: string } | null)?.id ?? null,
      firebaseUid: decoded.uid,
      email: decoded.email ?? (row as { email?: string } | null)?.email ?? null,
      emailVerified: !!decoded.email_verified,
    };
  } catch {
    return null;
  }
}
