'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getIdToken } from '@/lib/firebase-client';

const NETWORXRADIO_CROSS_LOGIN = 'https://www.networxradio.com/cross-domain-login';

function AuthHandoffContent() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<'idle' | 'getting-token' | 'redirecting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const returnUrl = searchParams.get('return_url') || NETWORXRADIO_CROSS_LOGIN;

  useEffect(() => {
    if (loading || status !== 'idle') return;

    if (!user) {
      const loginUrl = `/login?redirect=${encodeURIComponent('/auth-handoff?' + searchParams.toString())}`;
      window.location.href = loginUrl;
      return;
    }

    let cancelled = false;
    setStatus('getting-token');

    (async () => {
      try {
        const idToken = await getIdToken(true);
        if (!idToken || cancelled) return;

        const targetHost = returnUrl.startsWith('http') ? new URL(returnUrl).origin : 'https://www.networxradio.com';

        const res = await fetch('/api/auth/cross-domain-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, targetHost }),
        });

        if (cancelled) return;

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || 'Could not create sign-in link');
          setStatus('error');
          return;
        }

        const redirectUrl = data.redirectUrl || `${targetHost}/cross-domain-login?token=${data.token}`;
        setStatus('redirecting');
        window.location.href = redirectUrl;
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
  }, [loading, user, returnUrl, searchParams, status]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <p className="text-destructive mb-4">{error}</p>
          <a href="/pro-networx" className="text-primary hover:underline">
            Back to ProNetworx
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">
          {status === 'getting-token' ? 'Preparing sign-in…' : 'Redirecting to Networx Radio…'}
        </p>
      </div>
    </div>
  );
}

/**
 * When user on discovermeradio.com clicks "Networx Radio", they can be sent here with ?return_url=https://www.networxradio.com/...
 * If logged in, we get a one-time token from the backend and redirect to that URL with the token so they become logged in there too.
 */
export default function AuthHandoffPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading…</p>
          </div>
        </div>
      }
    >
      <AuthHandoffContent />
    </Suspense>
  );
}
