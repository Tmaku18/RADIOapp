'use client';

import { useEffect, useRef } from 'react';
import { useLikeEvents } from './useLikeEvents';

/**
 * Live Ripple: canvas ripple effect. Wire to vote/like events (Supabase Realtime on `likes` or backend) to trigger on each vote.
 * For now triggers a ripple on mount and on a timer as placeholder; replace with subscription to vote events.
 */
export function LiveRippleVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Array<{ x: number; y: number; t: number; r: number }>>([]);
  const addRippleRef = useRef<((x?: number, y?: number) => void) | null>(null);

  // Trigger ripples from real like/vote events (Supabase Realtime on `likes` INSERT)
  useLikeEvents(() => {
    addRippleRef.current?.();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      // Avoid cumulative scaling on repeated resize calls
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const addRipple = (x?: number, y?: number) => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ripplesRef.current.push({
        x: x ?? Math.random() * w,
        y: y ?? Math.random() * h,
        t: 0,
        r: 0,
      });
    };
    addRippleRef.current = addRipple;

    let raf = 0;
    const animate = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ctx.clearRect(0, 0, w, h);
      const ripples = ripplesRef.current;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.t += 0.02;
        r.r = r.t * 120;
        if (r.t >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        const alpha = 1 - r.t;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 245, 255, ${alpha * 0.4})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    addRipple();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
      addRippleRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
      aria-hidden
    />
  );
}
