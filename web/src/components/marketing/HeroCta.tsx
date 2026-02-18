'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function HeroCta() {
  const { profile, user } = useAuth();

  if (user && profile?.role === 'artist') {
    return (
      <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" asChild>
          <Link href="/artist/upload">Upload</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/artist/stats">Dashboard</Link>
        </Button>
      </div>
    );
  }

  if (user && profile?.role === 'service_provider') {
    return (
      <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" asChild>
          <Link href="/artist/services">My Services</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/discover">Pro-Directory</Link>
        </Button>
      </div>
    );
  }

  if (user && profile?.role === 'listener') {
    return (
      <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" asChild>
          <Link href="/listen">Listen now</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/competition">Vote</Link>
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
