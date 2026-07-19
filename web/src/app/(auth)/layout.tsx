'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ButterflyPattern } from '@/components/marketing/ButterflyPattern';

import { NETWORX_LOGO } from '@/lib/brand-assets';
import { PRO_NETWORX_APP_HOME, isProNetworxAppHost } from '@/lib/site-url';

// Auth header has a teal gradient background regardless of theme, so the
// dark wordmark (white words) is correct for both light and dark mode here.
const LOGO_SRC = NETWORX_LOGO;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Redirect authenticated users: respect redirect param when present
  useEffect(() => {
    if (!loading && user) {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const isDiscoverMe = isProNetworxAppHost(host);
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectParam = params?.get('redirect') ?? null;
      const safeRedirect = redirectParam && redirectParam.startsWith('/') ? redirectParam : null;
      const target = safeRedirect ?? (isDiscoverMe ? PRO_NETWORX_APP_HOME : '/dashboard');
      router.push(target);
    }
  }, [loading, user, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="relative overflow-hidden min-h-screen bg-primary text-primary-foreground flex items-center justify-center">
        <ButterflyPattern
          className="absolute inset-0"
          colorClassName="text-primary-foreground"
          tile={150}
          opacity={0.14}
        />
        <div className="relative z-10 animate-spin rounded-full h-12 w-12 border-b-2 border-primary-foreground" />
      </div>
    );
  }

  // If user is authenticated, don't render (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="relative overflow-hidden min-h-screen bg-primary text-primary-foreground flex flex-col">
      <ButterflyPattern
        className="absolute inset-0"
        colorClassName="text-primary-foreground"
        tile={150}
        opacity={0.14}
      />

      <header className="relative z-10 p-4 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center text-primary-foreground">
          <Image
            src={LOGO_SRC}
            alt="NETWORX Radio — The Butterfly Effect"
            width={280}
            height={280}
            className="h-14 sm:h-16 w-auto max-w-[min(280px,60vw)] object-contain object-left shrink-0"
            priority
            unoptimized
          />
        </Link>
        <ThemeToggle triggerClassName="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      <footer className="relative z-10 p-4 text-center text-primary-foreground/70 text-sm">
        <p>&copy; {new Date().getFullYear()} Networx. All rights reserved.</p>
      </footer>
    </div>
  );
}
