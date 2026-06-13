'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const REDIRECT_APP = '/pro-networx/home';
const REDIRECT_APP_ENCODED = encodeURIComponent(REDIRECT_APP);

/**
 * Hero call-to-action for the Pro-Networx landing page. Buttons are styled to
 * sit on the teal hero band: the primary CTA inverts to a white pill with
 * teal text for max contrast, and the secondary buttons use a translucent
 * white outline so they read on the colored background in both themes.
 *
 * Adapts to auth so a returning, signed-in member sees a one-click "Enter
 * Pro-Networx", while a first-time visitor sees sign-up / log-in instead of
 * an instant auth wall.
 */
export function LandingCta() {
  const { user, loading } = useAuth();

  const primaryClass =
    'bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-[var(--brand-glow)]';
  const outlineClass =
    'border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground';
  const ghostClass =
    'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground';

  if (!loading && user) {
    return (
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Button asChild size="lg" className={primaryClass}>
          <Link href={REDIRECT_APP}>Enter Pro-Networx</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className={outlineClass}>
          <Link href="/pro-networx/search">Browse the feed</Link>
        </Button>
        <Button asChild size="lg" variant="ghost" className={ghostClass}>
          <Link href="/pro-directory">Explore the directory</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
      <Button asChild size="lg" className={primaryClass}>
        <Link href={`/signup?redirect=${REDIRECT_APP_ENCODED}`}>
          Create your profile — free
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline" className={outlineClass}>
        <Link href={`/login?redirect=${REDIRECT_APP_ENCODED}`}>Log in</Link>
      </Button>
      <Button asChild size="lg" variant="ghost" className={ghostClass}>
        <Link href="/pro-directory">Explore the directory</Link>
      </Button>
    </div>
  );
}
