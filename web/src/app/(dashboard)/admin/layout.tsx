'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/api';

export default function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [allowed, setAllowed] = useState(profile?.role === 'admin');

  useEffect(() => {
    let cancelled = false;
    if (profile?.role === 'admin') {
      setAllowed(true);
      return;
    }
    if (loading) return;
    (async () => {
      try {
        const res = await usersApi.checkAdmin();
        if (cancelled) return;
        if (res.data?.isAdmin) {
          setAllowed(true);
          return;
        }
        router.replace('/dashboard');
      } catch {
        if (!cancelled) router.replace('/dashboard');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.role, loading, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
