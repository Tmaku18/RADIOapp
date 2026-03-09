'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
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
      <header className="p-4">
        <Link href="/" className="flex items-center gap-2 text-primary-foreground">
          <span className="size-8 shrink-0 rounded-lg bg-primary-foreground/20 flex items-center justify-center" aria-hidden>
            <svg viewBox="0 0 512 512" className="size-6 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="18" strokeLinecap="round" aria-hidden>
              <path d="M184 272c18 22 44 34 72 34s54-12 72-34" />
              <path d="M160 230c28-36 62-54 96-54s68 18 96 54" />
              <path d="M136 190c40-50 84-74 120-74s80 24 120 74" />
              <circle cx="256" cy="320" r="18" fill="currentColor" />
            </svg>
          </span>
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
