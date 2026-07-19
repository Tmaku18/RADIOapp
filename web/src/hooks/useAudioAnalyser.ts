'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ANALYSER_BARS,
  createAnalyserBarsBuffer,
  disconnectAnalyserSlot,
  dramatizeBars,
  ensureMediaElementAnalyser,
  fillIdleBars,
  fillSimulatedBars,
  reduceFrequencyBins,
  type AnalyserSlot,
} from '@/lib/audio-analyser';

/**
 * Web Audio FFT hook for a standalone `<audio>` element.
 * Ported from 3d useAudioAnalyser.js — used when not going through PlaybackProvider.
 */
export function useAudioAnalyser(url: string | null | undefined, bars = ANALYSER_BARS) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const slotRef = useRef<AnalyserSlot>({});
  const rawDataRef = useRef(createAnalyserBarsBuffer(bars * 4));
  const dataRef = useRef(createAnalyserBarsBuffer(bars));
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    ensureMediaElementAnalyser(audio, slotRef.current, ctxRef, bars * 4);
  }, [bars]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const an = slotRef.current.analyser;
      if (an && playing) {
        if (rawDataRef.current.length !== an.frequencyBinCount) {
          rawDataRef.current = new Uint8Array(an.frequencyBinCount);
        }
        an.getByteFrequencyData(rawDataRef.current as Uint8Array<ArrayBuffer>);
        reduceFrequencyBins(rawDataRef.current, dataRef.current);
        dramatizeBars(dataRef.current);
      } else if (playing) {
        fillSimulatedBars(dataRef.current, performance.now() / 1000);
      } else {
        fillIdleBars(dataRef.current, performance.now() / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bars, playing]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        ensureGraph();
        await audio.play();
        setPlaying(true);
      } else {
        audio.pause();
        setPlaying(false);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audio failed');
      setPlaying(false);
    }
  }, [ensureGraph]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.src = url;
    audio.crossOrigin = 'anonymous';
  }, [url]);

  useEffect(
    () => () => {
      disconnectAnalyserSlot(slotRef.current);
      try {
        ctxRef.current?.close?.();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { audioRef, playing, toggle, dataRef, error, setPlaying };
}
