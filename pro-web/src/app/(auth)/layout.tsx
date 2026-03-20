'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
      router.push('/directory');
    }
  }, [loading, user, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // If user is authenticated, don't render (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-5 py-4 border-b border-border/70 bg-background/80 backdrop-blur">
        <Link href="/directory" className="flex items-center gap-3">
          <Image
            src="/networx-logo.png"
            alt="Networx"
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
            unoptimized
          />
          <span className="font-semibold tracking-tight">Pro-Networx</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      <footer className="p-4 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} Pro-Networx</p>
      </footer>
    </div>
  );
}
