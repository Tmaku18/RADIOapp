'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

const LOCKED_MESSAGE =
  'Sign in or sign up to access the Pro-Network and connect with other creators.';

export function LockedDoor() {
  return (
    <div className="locked-door-overlay" aria-modal="true" role="dialog" aria-labelledby="locked-door-title">
      <div className="locked-door-content">
        <div className="lock-icon" aria-hidden>🔒</div>
        <h2 id="locked-door-title" className="text-2xl font-bold mb-3">
          Pro-Network
        </h2>
        <p className="text-white/90 mb-6">{LOCKED_MESSAGE}</p>
        <Button asChild size="lg" className="bg-white text-[#6A0DAD] hover:bg-white/90">
          <Link href="/signup">Sign up</Link>
        </Button>
      </div>
    </div>
  );
}
