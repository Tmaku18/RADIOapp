'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const LOGO_SRC = '/networx-logo.png';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const redirectParam = searchParams.get('redirect');

  // Redirect authenticated users: respect redirect param when present
  useEffect(() => {
    if (!loading && user) {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const isDiscoverMe = host === 'discovermeradio.com' || host === 'www.discovermeradio.com';
      const safeRedirect =
        redirectParam && redirectParam.startsWith('/') ? redirectParam : null;
      const target = safeRedirect ?? (isDiscoverMe ? '/pro-networx/directory' : '/dashboard');
      router.push(target);
    }
  }, [loading, user, router, redirectParam]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-foreground"></div>
      </div>
    );
  }

  // If user is authenticated, don't render (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex flex-col">
      <header className="p-4">
        <Link href="/" className="flex items-center gap-3 text-primary-foreground">
          <Image
            src={LOGO_SRC}
            alt=""
            width={140}
            height={50}
            className="h-10 w-auto object-contain object-left shrink-0"
            priority
            unoptimized
          />
          <span className="text-xl font-bold">Networx</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      <footer className="p-4 text-center text-primary-foreground/70 text-sm">
        <p>&copy; {new Date().getFullYear()} Networx. All rights reserved.</p>
      </footer>
    </div>
  );
}
