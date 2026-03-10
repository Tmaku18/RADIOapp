'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Page reached when user is redirected from another domain (e.g. discovermeradio.com) with ?token=xxx.
 * Exchanges the token for a session cookie on this origin, then redirects to dashboard.
 */
export default function CrossDomainLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'exchanging' | 'done' | 'error'>('exchanging');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing token');
      setStatus('error');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/auth/cross-domain-exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (cancelled) return;

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || 'Sign-in failed');
          setStatus('error');
          return;
        }

        setStatus('done');
        router.replace('/dashboard');
      } catch (e) {
        if (!cancelled) {
          setError('Something went wrong');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <p className="text-destructive mb-4">{error}</p>
          <a href="/login" className="text-primary hover:underline">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
