'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProNetworxAppShell } from '@/components/dimension/ProNetworxAppShell';

export default function ProNetworxDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      const redirect = encodeURIComponent(pathname || '/pro-networx/home');
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [loading, user, router, pathname]);

  if (!loading && !user) return null;

  return <ProNetworxAppShell>{children}</ProNetworxAppShell>;
}
