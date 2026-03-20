'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { GlobalPulseTopBar } from '@/components/pro/GlobalPulseTopBar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=' + encodeURIComponent(pathname));
    }
  }, [loading, pathname, router, user]);

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <GlobalPulseTopBar />
      <main className="min-h-[calc(100vh-4rem)] bg-muted/10">
        {children}
      </main>
    </div>
  );
}
