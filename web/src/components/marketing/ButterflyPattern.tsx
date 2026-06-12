'use client';

import { useId } from 'react';

type ButterflyPatternProps = {
  /** Extra classes for the wrapper (e.g. positioning). */
  className?: string;
  /**
   * Tailwind text-color class that sets the butterfly color via `currentColor`.
   * Pick one that contrasts the section background so the pattern doesn't blend.
   */
  colorClassName?: string;
  /** Size (px) of one repeating tile. Larger = more spacing between butterflies. */
  tile?: number;
  /** Overall opacity of the pattern (kept subtle so content stays readable). */
  opacity?: number;
};

/**
 * Decorative, tiled NETWORX butterfly pattern for filling blank section
 * backgrounds. Rendered as an inline SVG `<pattern>` using `currentColor`, so
 * the color is controlled with a Tailwind text-* class and can be made to
 * contrast (not blend into) whatever background it sits on.
 *
 * Always render this as an absolutely-positioned, pointer-events-none layer
 * behind the section content (give the content `relative z-10`).
 */
export function ButterflyPattern({
  className,
  colorClassName = 'text-primary',
  tile = 150,
  opacity = 0.12,
}: ButterflyPatternProps) {
  const patternId = useId();

  return (
    <div
      aria-hidden
      className={`pointer-events-none ${colorClassName} ${className ?? ''}`}
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity }}
      >
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={tile}
            height={tile}
            patternTransform="rotate(0)"
          >
            {/* viewBox-equivalent: butterfly drawn within a 140x140 cell, scaled to `tile`. */}
            <g transform={`scale(${tile / 140})`} fill="none" stroke="currentColor">
              <g transform="translate(10,20)">
                {/* Wing outline swooshes (upper + lower, both sides) */}
                <g
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  fill="none"
                >
                  <path d="M60 48 C45 33 26 31 15 41" />
                  <path d="M60 48 C75 33 94 31 105 41" />
                  <path d="M60 54 C46 66 30 72 20 66" />
                  <path d="M60 54 C74 66 90 72 100 66" />
                </g>

                {/* Equalizer bars — taller toward the center, like the brand mark. */}
                <g fill="currentColor" stroke="none">
                  {/* upper-left */}
                  <rect x="24" y="38" width="2.6" height="10" rx="1.3" />
                  <rect x="30" y="34" width="2.6" height="14" rx="1.3" />
                  <rect x="36" y="29" width="2.6" height="19" rx="1.3" />
                  <rect x="42" y="25" width="2.6" height="23" rx="1.3" />
                  <rect x="48" y="22" width="2.6" height="26" rx="1.3" />
                  {/* upper-right (mirror) */}
                  <rect x="89.4" y="22" width="2.6" height="26" rx="1.3" />
                  <rect x="83.4" y="25" width="2.6" height="23" rx="1.3" />
                  <rect x="77.4" y="29" width="2.6" height="19" rx="1.3" />
                  <rect x="71.4" y="34" width="2.6" height="14" rx="1.3" />
                  <rect x="65.4" y="38" width="2.6" height="10" rx="1.3" />
                  {/* lower-left */}
                  <rect x="28" y="54" width="2.6" height="9" rx="1.3" />
                  <rect x="34" y="54" width="2.6" height="13" rx="1.3" />
                  <rect x="40" y="54" width="2.6" height="17" rx="1.3" />
                  <rect x="46" y="54" width="2.6" height="20" rx="1.3" />
                  {/* lower-right (mirror) */}
                  <rect x="91.4" y="54" width="2.6" height="9" rx="1.3" />
                  <rect x="85.4" y="54" width="2.6" height="13" rx="1.3" />
                  <rect x="79.4" y="54" width="2.6" height="17" rx="1.3" />
                  <rect x="73.4" y="54" width="2.6" height="20" rx="1.3" />
                </g>

                {/* Antennae + body */}
                <g strokeWidth={2.2} strokeLinecap="round">
                  <path d="M57 24 C53 16 49 12 44 9" />
                  <path d="M63 24 C67 16 71 12 76 9" />
                </g>
                <ellipse cx="60" cy="50" rx="2.4" ry="14" fill="currentColor" stroke="none" />
              </g>
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
