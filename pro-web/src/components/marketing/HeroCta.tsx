'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function HeroCta() {
  const { profile, user } = useAuth();

  if (user && profile) {
    return (
      <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" asChild>
          <Link href="/directory">Browse the directory</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/onboarding">Build my profile</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
      <Button size="lg" asChild>
        <Link href="/signup">Get Started Free</Link>
      </Button>
      <Button size="lg" variant="outline" asChild>
        <Link href="/login">Log in</Link>
      </Button>
    </div>
  );
}
