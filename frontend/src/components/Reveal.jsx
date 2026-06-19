import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";

/**
 * Reveal — wraps children, animates from below + faded when scrolled into view.
 * Props:
 *  - delay (s)
 *  - y (px) — initial vertical offset
 *  - duration (s)
 *  - once (bool) — animate only first time it enters
 *  - as — element tag (default "div")
 *  - className
 */
export default function Reveal({
  children,
  delay = 0,
  y = 28,
  duration = 0.8,
  once = true,
  as = "div",
  className = "",
  ...rest
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: "-10% 0px -10% 0px" });
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag
      ref={ref}
      initial={{ opacity: 0, y, filter: "blur(10px)" }}
      animate={
        inView
          ? { opacity: 1, y: 0, filter: "blur(0px)" }
          : { opacity: 0, y, filter: "blur(10px)" }
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
