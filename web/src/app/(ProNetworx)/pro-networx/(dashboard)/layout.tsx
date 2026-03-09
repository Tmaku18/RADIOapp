'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProNetworxDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  if (!loading && !user) {
    const redirect = encodeURIComponent(pathname || '/pro-networx/directory');
    router.replace(`/login?redirect=${redirect}`);
    return null;
  }

  return <>{children}</>;
}
