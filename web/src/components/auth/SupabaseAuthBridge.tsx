'use client';

import { useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Dual-auth bridge: refresh Supabase session alongside Firebase during migration.
 * Firebase remains primary in AuthContext until AUTH_PRIMARY=supabase.
 */
export function SupabaseAuthBridge() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AUTH_PRIMARY === 'supabase') {
      const supabase = getSupabaseBrowserClient();
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.access_token) {
          document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=3600; SameSite=Lax`;
        }
      });
      return () => sub.subscription.unsubscribe();
    }
  }, []);

  return null;
}
