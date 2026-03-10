'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUpWithEmail, signInWithGoogle, loading, error } = useAuth();
  const redirectParam = searchParams.get('redirect');
  const [redirectTo, setRedirectTo] = useState(redirectParam || '/dashboard');

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const roleParam = searchParams.get('role') as 'listener' | 'artist' | null;
  const [role, setRole] = useState<'listener' | 'artist'>(
    roleParam === 'artist' ? 'artist' : 'listener'
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // On discovermeradio.com, default to ProNetworx app (directory) so users land in the app after signup
  useEffect(() => {
    if (redirectParam) return;
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (host === 'discovermeradio.com' || host === 'www.discovermeradio.com') {
      setRedirectTo('/pro-networx/directory');
    }
  }, [redirectParam]);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      await signUpWithEmail(email, password, role as 'listener' | 'artist', displayName.trim() || undefined);
      router.push(redirectTo);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('radioapp_signup_role', role);
      }
      await signInWithGoogle();
      router.push(redirectTo);
    } catch (err) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('radioapp_signup_role');
      }
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setLocalError(apiMessage ?? (err instanceof Error ? err.message : 'Failed to sign up with Google'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
        <p className="text-muted-foreground mt-2">Join Networx — discover gems, share your music, or offer your craft</p>
      </div>

      {displayError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {/* Role Selection: Prospector (listener) or Gem (artist). Catalysts sign up on ProNetworx. */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          I want to...
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setRole('listener')}
            className={`p-4 rounded-lg border-2 transition-all ${
              role === 'listener'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-muted-foreground/30'
            }`}
          >
            <div className="text-2xl mb-2">🎧</div>
            <div className="font-medium text-foreground">Prospector</div>
            <div className="text-sm text-muted-foreground">Discover new music</div>
          </button>
          <button
            type="button"
            onClick={() => setRole('artist')}
            className={`p-4 rounded-lg border-2 transition-all ${
              role === 'artist'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-muted-foreground/30'
            }`}
          >
            <div className="text-2xl mb-2">🎤</div>
            <div className="font-medium text-foreground">Gem</div>
            <div className="text-sm text-muted-foreground">Share my music</div>
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Want to offer services to artists? Sign up as a Catalyst on ProNetworx after you create your account.
        </p>
      </div>

      {/* Google Sign Up */}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-3 mb-6 border-border bg-card hover:bg-muted"
        onClick={handleGoogleSignup}
        disabled={isSubmitting || loading}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span>Continue with Google</span>
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-card text-muted-foreground">Or sign up with email</span>
        </div>
      </div>

      {/* Email Sign Up */}
      <form onSubmit={handleEmailSignup} className="space-y-4">
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
          <Label htmlFor="displayName">Display name (optional)</Label>
          <Input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How you want to be shown"
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
            minLength={6}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || loading}
        >
          {isSubmitting || loading ? 'Creating account...' : `Create ${role === 'artist' ? 'Gem' : 'Prospector'} Account`}
        </Button>
      </form>

      <p className="mt-6 text-center text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        By signing up, you agree to our{' '}
        <Link href="/terms" className="text-primary hover:text-primary/90">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-primary hover:text-primary/90">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <Card>
        <CardContent className="pt-8 pb-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    }>
      <SignupForm />
    </Suspense>
  );
}
