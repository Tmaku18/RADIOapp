'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProNetworxLanding } from '@/components/dimension/ProNetworxLanding';
import { PRO_NETWORX_APP_HOME } from '@/lib/site-url';

export function ProNetworxRootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(PRO_NETWORX_APP_HOME);
    }
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
      </div>
    );
  }

  return <ProNetworxLanding variant="app" />;
}
