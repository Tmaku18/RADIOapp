'use client';

import { useEffect, useRef } from 'react';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';

export function CyberBackdrop() {
  const playback = usePlaybackOptional();
  const bassRef = playback?.bassRef;
  const cyanBlobRef = useRef<HTMLDivElement>(null);
  const pinkBlobRef = useRef<HTMLDivElement>(null);
  const yellowBlobRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const b = bassRef?.current ?? 0;
      const i = Math.min(1, b * 1.6);
      if (cyanBlobRef.current) {
        cyanBlobRef.current.style.opacity = `${0.55 + i * 0.45}`;
        cyanBlobRef.current.style.transform = `translate3d(0,0,0) scale(${1 + i * 0.18})`;
      }
      if (pinkBlobRef.current) {
        pinkBlobRef.current.style.opacity = `${0.55 + i * 0.4}`;
        pinkBlobRef.current.style.transform = `translate3d(0,0,0) scale(${1 + i * 0.15})`;
      }
      if (yellowBlobRef.current) {
        yellowBlobRef.current.style.opacity = `${0.4 + i * 0.45}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bassRef]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <div className="absolute inset-0 cyber-grid opacity-30" />
      <div className="absolute inset-0 bg-gradient-radial-dim" />
      <div
        ref={cyanBlobRef}
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[120px] will-change-transform"
      />
      <div
        ref={pinkBlobRef}
        className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-pink-500/10 blur-[140px] will-change-transform"
      />
      <div
        ref={yellowBlobRef}
        className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-yellow-500/5 blur-[120px]"
      />
    </div>
  );
}
