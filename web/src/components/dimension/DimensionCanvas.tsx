'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const ButterflyHeroScene = dynamic(
  () => import('./ButterflyHeroScene').then((m) => m.ButterflyHeroScene),
  { ssr: false },
);

export function DimensionCanvas({ className }: { className?: string }) {
  return (
    <div className={className ?? 'absolute inset-0'}>
      <Suspense fallback={<div className="absolute inset-0 bg-[#050505]" />}>
        <ButterflyHeroScene />
      </Suspense>
    </div>
  );
}
