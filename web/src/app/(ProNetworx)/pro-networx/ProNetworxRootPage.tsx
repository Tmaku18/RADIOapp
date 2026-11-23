'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProNetworxLanding } from '@/components/dimension/ProNetworxLanding';
import { PRO_NETWORX_APP_HOME } from '@/lib/site-url';
import type { ProMarketingStats } from '@/lib/pro-networx-marketing-stats';

export function ProNetworxRootPage({
  initialMarketingStats,
}: {
  initialMarketingStats?: ProMarketingStats | null;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(PRO_NETWORX_APP_HOME);
    }
  }, [loading, user, router]);

  if (loading || user) {
    return <div className="min-h-[50vh]" />;
  }

  return (
    <ProNetworxLanding
      variant="app"
      initialMarketingStats={initialMarketingStats}
    />
  );
}
