'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const REDIRECT_APP = '/pro-networx/home';
const REDIRECT_APP_ENCODED = encodeURIComponent(REDIRECT_APP);

/**
 * Hero call-to-action for the Pro-Networx landing page. It adapts to auth so a
 * returning member who is already signed in on this domain gets a one-click
 * "Enter Pro-Networx", while a first-time visitor (e.g. arriving from Networx
 * Radio) sees context plus sign-up / log-in instead of an instant auth wall.
 */
export function LandingCta() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return (
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Button
          asChild
          size="lg"
          className="bg-primary text-primary-foreground hover:opacity-90 shadow-[var(--brand-glow)]"
        >
          <Link href={REDIRECT_APP}>Enter Pro Networks</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="border-primary/30">
          <Link href="/pro-networx/search">Browse the feed</Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="/pro-directory">Explore the directory</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
      <Button
        asChild
        size="lg"
        className="bg-primary text-primary-foreground hover:opacity-90 shadow-[var(--brand-glow)]"
      >
        <Link href={`/signup?redirect=${REDIRECT_APP_ENCODED}`}>
          Create your profile — free
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="border-primary/30">
        <Link href={`/login?redirect=${REDIRECT_APP_ENCODED}`}>Log in</Link>
      </Button>
      <Button asChild size="lg" variant="ghost">
        <Link href="/pro-directory">Explore the directory</Link>
      </Button>
    </div>
  );
}
