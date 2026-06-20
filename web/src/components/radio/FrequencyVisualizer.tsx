'use client';

import { useEffect, useRef } from 'react';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { ANALYSER_BARS } from '@/lib/audio-analyser';

type FrequencyVisualizerProps = {
  playing?: boolean;
};

export function FrequencyVisualizer({ playing = false }: FrequencyVisualizerProps) {
  const playback = usePlaybackOptional();
  const dataRef = playback?.barsRef;
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const data = dataRef?.current;
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        const v = (data?.[i] ?? 0) / 255;
        const h = Math.max(0.04, v);
        el.style.height = `${h * 100}%`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dataRef]);

  return (
    <div
      className="flex items-end justify-between gap-1.5 h-20 px-2"
      data-testid="netx-visualizer"
    >
      {Array.from({ length: ANALYSER_BARS }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className={`flex-1 min-w-[3px] rounded-sm transition-[height] duration-75 ease-out ${
            playing
              ? 'bg-gradient-to-t from-cyan-400 via-cyan-300 to-pink-500'
              : 'bg-gradient-to-t from-cyan-400/40 via-cyan-300/30 to-pink-500/40'
          }`}
          style={{ height: '4%' }}
        />
      ))}
    </div>
  );
}
