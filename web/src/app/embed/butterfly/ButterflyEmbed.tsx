'use client';

import { useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Reuse the exact web Three.js hero so the in-app WebView is pixel-parity.
const ButterflyHeroScene = dynamic(
  () =>
    import('@/components/dimension/ButterflyHeroScene').then(
      (m) => m.ButterflyHeroScene,
    ),
  { ssr: false, loading: () => null },
);

type FlutterBridge = {
  callHandler?: (name: string, ...args: unknown[]) => void;
};

function notifyFlutter(event: 'ready' | 'failed', detail?: string) {
  const bridge = (window as unknown as { flutter_inappwebview?: FlutterBridge })
    .flutter_inappwebview;
  try {
    bridge?.callHandler?.('butterflyStatus', event, detail ?? '');
  } catch {
    // Not running inside the app WebView; nothing to notify.
  }
}

export function ButterflyEmbed() {
  const handleReady = useCallback(() => notifyFlutter('ready'), []);

  useEffect(() => {
    // Surface WebGL context failures so the app can keep its 2D hero instead
    // of fading to a black canvas.
    const onContextFailure = (e: Event) => {
      e.preventDefault?.();
      notifyFlutter('failed', 'webglcontextcreationerror');
    };
    window.addEventListener('webglcontextcreationerror', onContextFailure, true);
    return () =>
      window.removeEventListener(
        'webglcontextcreationerror',
        onContextFailure,
        true,
      );
  }, []);

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#050505',
      }}
    >
      <ButterflyHeroScene onReady={handleReady} />
    </main>
  );
}
