'use client';

import { useEffect, useRef } from 'react';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { ANALYSER_BARS } from '@/lib/audio-analyser';
import { cn } from '@/lib/utils';

type FrequencyVisualizerProps = {
  playing?: boolean;
  /** Number of bars to render (samples evenly from the FFT buffer). */
  barCount?: number;
  className?: string;
  barClassName?: string;
};

export function FrequencyVisualizer({
  playing = false,
  barCount = ANALYSER_BARS,
  className,
  barClassName,
}: FrequencyVisualizerProps) {
  const playback = usePlaybackOptional();
  const dataRef = playback?.barsRef;
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const data = dataRef?.current;
      const total = data?.length ?? ANALYSER_BARS;
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        // Evenly sample the full FFT spectrum into [barCount] bars.
        const srcIdx =
          barCount <= 1
            ? 0
            : Math.min(
                total - 1,
                Math.round((i / Math.max(1, barCount - 1)) * (total - 1)),
              );
        const v = (data?.[srcIdx] ?? 0) / 255;
        const h = Math.max(0.04, v);
        el.style.height = `${h * 100}%`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dataRef, barCount]);

  return (
    <div
      className={cn('flex items-end justify-between gap-1.5 h-20 px-2', className)}
      data-testid="netx-visualizer"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className={cn(
            'flex-1 min-w-[3px] rounded-sm transition-[height] duration-75 ease-out',
            playing
              ? 'bg-gradient-to-t from-cyan-400 via-cyan-300 to-pink-500'
              : 'bg-gradient-to-t from-cyan-400/40 via-cyan-300/30 to-pink-500/40',
            barClassName,
          )}
          style={{ height: '4%' }}
        />
      ))}
    </div>
  );
}
