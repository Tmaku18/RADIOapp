'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export function ButterflyPulseOverlay(props: { active: boolean }) {
  const prefersReducedMotion = useReducedMotion();

  // Prevent scroll-jank when overlay is active (esp. mobile).
  useEffect(() => {
    if (!props.active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [props.active]);

  if (prefersReducedMotion) return null;

  return (
    <AnimatePresence>
      {props.active && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Cyan pulse */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, rgba(0,255,255,0.28) 0%, rgba(0,255,255,0.10) 22%, rgba(0,0,0,0) 60%)',
            }}
            initial={{ scale: 0.92, opacity: 0.0 }}
            animate={{ scale: [0.92, 1.05, 1.12], opacity: [0.0, 1.0, 0.0] }}
            transition={{ duration: 0.95, ease: 'easeOut' }}
          />

          {/* Lime accent */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, rgba(204,255,0,0.18) 0%, rgba(204,255,0,0.08) 24%, rgba(0,0,0,0) 62%)',
              mixBlendMode: 'screen',
            }}
            initial={{ scale: 0.96, opacity: 0.0 }}
            animate={{ scale: [0.96, 1.07, 1.15], opacity: [0.0, 1.0, 0.0] }}
            transition={{ duration: 1.05, ease: 'easeOut' }}
          />

          {/* Butterfly shimmer arcs */}
          <motion.div
            className="absolute left-1/2 top-[45%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              boxShadow:
                '0 0 60px rgba(0,255,255,0.35), 0 0 140px rgba(204,255,0,0.18)',
              border: '1px solid rgba(0,255,255,0.22)',
              background:
                'conic-gradient(from 90deg, rgba(0,255,255,0.0), rgba(0,255,255,0.20), rgba(204,255,0,0.0), rgba(204,255,0,0.14), rgba(0,255,255,0.0))',
              filter: 'blur(0.2px)',
              opacity: 0.9,
            }}
            initial={{ scale: 0.7, rotate: -10, opacity: 0 }}
            animate={{ scale: [0.7, 1.08], rotate: [-10, 18], opacity: [0, 0.95, 0] }}
            transition={{ duration: 0.95, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

