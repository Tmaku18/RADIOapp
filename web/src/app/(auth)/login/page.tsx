'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleSelectionModal } from '@/components/auth/RoleSelectionModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    profile,
    signInWithGoogle,
    signInWithEmail,
    loading,
    error,
    pendingGoogleUser,
    completeGoogleSignUp,
    cancelGoogleSignUp,
  } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectParam = searchParams.get('redirect');
  const [redirectTo, setRedirectTo] = useState(redirectParam || '/dashboard');
  const sessionExpired = searchParams.get('session_expired') === 'true';
  const isProNetworxRedirect = (redirectParam ?? redirectTo ?? '').includes('pro-networx');
  const [chooseRoleBeforeGoogle, setChooseRoleBeforeGoogle] = useState(false);

  // On discovermeradio.com, default to ProNetworx app (directory) so users land in the app after login
  useEffect(() => {
    if (redirectParam) return;
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (host === 'discovermeradio.com' || host === 'www.discovermeradio.com') {
      setRedirectTo('/pro-networx/directory');
    }
  }, [redirectParam]);

  useEffect(() => {
    if (profile && !pendingGoogleUser) {
      router.push(redirectTo);
    }
  }, [profile, pendingGoogleUser, router, redirectTo]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    try {
      await signInWithEmail(email, password);
      router.push(redirectTo);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError(null);
    setIsSubmitting(true);

    try {
      // When user explicitly chose a role via "Choose your role", store it so AuthContext uses it
      if (chooseRoleBeforeGoogle && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('radioapp_choose_role', '1');
      }
      await signInWithGoogle();
    } catch (err) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setLocalError(apiMessage ?? (err instanceof Error ? err.message : 'Failed to sign in with Google'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleSelect = async (role: 'listener' | 'artist' | 'service_provider') => {
    setLocalError(null);
    try {
      await completeGoogleSignUp(role);
      router.push(redirectTo);
    } catch (err) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setLocalError(apiMessage ?? (err instanceof Error ? err.message : 'Failed to complete sign up'));
    }
  };

  const displayError = localError || error;

  return (
    <>
      {pendingGoogleUser && (
        <RoleSelectionModal
          onSelect={handleRoleSelect}
          onCancel={cancelGoogleSignUp}
          loading={loading}
          error={displayError}
          allowCatalyst={isProNetworxRedirect}
        />
      )}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Sign in to your Networx account</p>
        </div>

      {sessionExpired && (
        <Alert className="mb-6 border-warning/50 bg-warning/10 text-foreground">
          <AlertDescription>Your session has expired. Please sign in again.</AlertDescription>
        </Alert>
      )}

      {displayError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {/* Google Sign In */}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-3 mb-6 border-border bg-card hover:bg-muted"
        onClick={handleGoogleLogin}
        disabled={isSubmitting || loading}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        <span>Continue with Google</span>
      </Button>

      <p className="text-center text-sm text-muted-foreground mb-4">
        Signing in as Artist or Catalyst?{' '}
        <button
          type="button"
          onClick={() => setChooseRoleBeforeGoogle(true)}
          className="text-primary font-medium hover:underline"
        >
          Choose your role
        </button>
        {' before continuing with Google.'}
      </p>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-card text-muted-foreground">Or continue with email</span>
        </div>
      </div>

      {/* Email Sign In */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || loading}
        >
          {isSubmitting || loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          Sign up
        </Link>
      </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Card>
        <CardContent className="pt-8 pb-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    }>
      <LoginForm />
    </Suspense>
  );
}
