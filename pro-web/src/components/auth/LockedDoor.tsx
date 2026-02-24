'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

const LOCKED_MESSAGE =
  'The Pro-Network is an exclusive hub for verified Networx Artists. Want to move from the crowd to the stage?';

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
          <Link href="/signup?role=artist">Apply for Artist Status</Link>
        </Button>
      </div>
    </div>
  );
}
