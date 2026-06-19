'use client';

import { useRef, type ElementType, type ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  once?: boolean;
  as?: ElementType;
  className?: string;
} & Record<string, unknown>;

export function Reveal({
  children,
  delay = 0,
  y = 28,
  duration = 0.8,
  once = true,
  as = 'div',
  className = '',
  ...rest
}: RevealProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: '-10% 0px -10% 0px' });
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  return (
    <MotionTag
      ref={ref}
      initial={{ opacity: 0, y, filter: 'blur(10px)' }}
      animate={
        inView
          ? { opacity: 1, y: 0, filter: 'blur(0px)' }
          : { opacity: 0, y, filter: 'blur(10px)' }
      }
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
