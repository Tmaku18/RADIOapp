'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';

type BassPulseLogoProps = {
  children: React.ReactNode;
  className?: string;
};

/** Bass-reactive glow wrapper for marketing nav logo (mirrors 3d Nav.jsx). */
export function BassPulseLogo({ children, className = '' }: BassPulseLogoProps) {
  const playback = usePlaybackOptional();
  const bassRef = playback?.bassRef;
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const b = bassRef?.current ?? 0;
      const i = Math.min(1, b * 1.5);
      if (wrapRef.current) {
        wrapRef.current.style.boxShadow = `0 0 ${8 + i * 28}px rgba(0,240,255,${0.35 + i * 0.55}), 0 0 ${18 + i * 60}px rgba(0,240,255,${0.1 + i * 0.35})`;
        wrapRef.current.style.borderColor = `rgba(0,240,255,${0.4 + i * 0.55})`;
      }
      if (innerRef.current) {
        innerRef.current.style.transform = `scale(${1 + i * 0.12})`;
        innerRef.current.style.filter = `drop-shadow(0 0 ${4 + i * 14}px rgba(0,240,255,${0.4 + i * 0.5}))`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bassRef]);

  return (
    <div
      ref={wrapRef}
      className={`rounded-md border border-cyan-400/40 overflow-hidden transition-[box-shadow,border-color] duration-75 ${className}`}
    >
      <div ref={innerRef} className="transition-[transform,filter] duration-75">
        {children}
      </div>
    </div>
  );
}

export function useBassPulseRef(
  bassRef: RefObject<number> | undefined,
  opts?: { scale?: number; glowScale?: number },
) {
  const elRef = useRef<HTMLDivElement>(null);
  const scale = opts?.scale ?? 1.5;
  const glowScale = opts?.glowScale ?? 1;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const b = bassRef?.current ?? 0;
      const i = Math.min(1, b * scale);
      if (elRef.current) {
        elRef.current.style.boxShadow = `0 0 ${6 * glowScale + i * 22 * glowScale}px rgba(0,240,255,${0.25 + i * 0.55})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bassRef, scale, glowScale]);

  return elRef;
}
