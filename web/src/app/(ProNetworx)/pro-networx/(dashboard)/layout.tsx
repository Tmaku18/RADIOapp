'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProNetworxAppShell } from '@/components/dimension/ProNetworxAppShell';
import { isGuestBrowse } from '@/lib/guest';

export default function ProNetworxDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [guest, setGuest] = useState(false);
  const [guestChecked, setGuestChecked] = useState(false);

  useEffect(() => {
    setGuest(isGuestBrowse());
    setGuestChecked(true);
  }, [pathname, user]);

  useEffect(() => {
    if (!guestChecked || loading) return;
    if (!user && !isGuestBrowse()) {
      const redirect = encodeURIComponent(pathname || '/pro-networx/home');
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [guestChecked, loading, user, router, pathname, guest]);

  if (!guestChecked || (!loading && !user && !guest)) return null;

  return <ProNetworxAppShell>{children}</ProNetworxAppShell>;
}
