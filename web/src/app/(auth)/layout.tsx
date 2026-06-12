'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

import { NETWORX_LOGO } from '@/lib/brand-assets';

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
      const isDiscoverMe = host === 'pro-networx.com' || host === 'www.pro-networx.com';
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectParam = params?.get('redirect') ?? null;
      const safeRedirect = redirectParam && redirectParam.startsWith('/') ? redirectParam : null;
      const target = safeRedirect ?? (isDiscoverMe ? '/pro-networx/directory' : '/dashboard');
      router.push(target);
    }
  }, [loading, user, router]);

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
      <header className="p-4 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center text-primary-foreground">
          <Image
            src={LOGO_SRC}
            alt="NETWORX Radio — The Butterfly Effect"
            width={220}
            height={64}
            className="h-12 sm:h-14 w-auto max-w-[min(220px,55vw)] object-contain object-left shrink-0"
            priority
            unoptimized
          />
        </Link>
        <ThemeToggle triggerClassName="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" />
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
