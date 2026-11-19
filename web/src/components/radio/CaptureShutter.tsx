'use client';

import { useRef } from 'react';

const HOLD_MS = 450;

/** Wordless shutter. Hold to record, release to stop, tap for a photo. */
export function CaptureShutter({
  progress,
  recording,
  disabled,
  onHoldStart,
  onHoldEnd,
  onTap,
}: {
  progress: number;
  recording: boolean;
  disabled?: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onTap?: () => void;
}) {
  const timer = useRef<number | null>(null);
  const holding = useRef(false);
  const filled = Math.max(0, Math.min(1, progress));
  const clear = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const release = () => {
    clear();
    if (holding.current || recording) onHoldEnd();
    else onTap?.();
    holding.current = false;
  };

  return (
    <button
      type="button"
      aria-label={recording ? 'Recording' : 'Record'}
      disabled={disabled}
      onPointerDown={(event) => {
        if (disabled) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        holding.current = false;
        clear();
        timer.current = window.setTimeout(() => {
          holding.current = true;
          onHoldStart();
        }, HOLD_MS);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      className="relative h-[84px] w-[84px] touch-none rounded-full disabled:opacity-40"
    >
      <svg viewBox="0 0 84 84" className="h-full w-full">
        <circle cx="42" cy="42" r="38" fill="none" stroke="white" strokeWidth="4" />
        {recording && filled > 0 ? (
          <circle
            cx="42"
            cy="42"
            r="38"
            fill="none"
            stroke="#ff2d2d"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${filled * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
            transform="rotate(-90 42 42)"
          />
        ) : null}
        <circle cx="42" cy="42" r={recording ? 28 : 32} fill={recording ? '#ff2d2d' : 'white'} />
      </svg>
    </button>
  );
}
