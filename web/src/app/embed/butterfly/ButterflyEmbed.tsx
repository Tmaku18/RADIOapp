'use client';

import dynamic from 'next/dynamic';

// Reuse the exact web Three.js hero so the in-app WebView is pixel-parity.
const ButterflyHeroScene = dynamic(
  () =>
    import('@/components/dimension/ButterflyHeroScene').then(
      (m) => m.ButterflyHeroScene,
    ),
  { ssr: false, loading: () => null },
);

export function ButterflyEmbed() {
  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#050505',
      }}
    >
      <ButterflyHeroScene />
    </main>
  );
}
