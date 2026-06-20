import { useRef, useEffect, useState, useCallback } from "react";

/**
 * useAudioAnalyser
 * Returns a real <audio> element ref, play/pause controls, and a ref to live
 * FFT data (Uint8Array, length = bars). One AudioContext per instance, lazily
 * resumed on first user gesture (browser autoplay policy).
 *
 * Usage:
 *   const { audioRef, playing, toggle, dataRef, bars } = useAudioAnalyser(url, 32);
 *   <audio ref={audioRef} src={url} crossOrigin="anonymous" />
 *   // read dataRef.current[i] (0..255) in a rAF loop
 */
export default function useAudioAnalyser(url, bars = 32) {
  const audioRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const dataRef = useRef(new Uint8Array(bars));
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);

  // Lazy init AudioContext + AnalyserNode on first play
  const ensureGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (!sourceRef.current) {
      sourceRef.current = ctx.createMediaElementSource(audio);
      const an = ctx.createAnalyser();
      an.fftSize = Math.max(64, bars * 4); // 128 for 32 bars
      an.smoothingTimeConstant = 0.78;
      sourceRef.current.connect(an);
      an.connect(ctx.destination);
      analyserRef.current = an;
      // Sample subset down to `bars` bins
      dataRef.current = new Uint8Array(an.frequencyBinCount);
    }
    if (ctx.state === "suspended") ctx.resume();
  }, [bars]);

  // Pull FFT samples each frame and reduce to `bars` averaged bins
  const binBufferRef = useRef(new Uint8Array(bars));
  useEffect(() => {
    let raf;
    const tick = () => {
      const an = analyserRef.current;
      if (an) {
        an.getByteFrequencyData(dataRef.current);
        // Reduce frequencyBinCount -> bars bins, log-spaced for nicer music feel
        const N = dataRef.current.length;
        for (let i = 0; i < bars; i++) {
          const t0 = i / bars;
          const t1 = (i + 1) / bars;
          // Bias the low end (more bars in bass region)
          const s = Math.floor(Math.pow(t0, 1.6) * N);
          const e = Math.max(s + 1, Math.floor(Math.pow(t1, 1.6) * N));
          let sum = 0;
          for (let j = s; j < e && j < N; j++) sum += dataRef.current[j];
          binBufferRef.current[i] = sum / Math.max(1, e - s);
        }
      } else {
        // Idle visualizer when not playing — gentle synthetic motion
        const now = performance.now() / 1000;
        for (let i = 0; i < bars; i++) {
          binBufferRef.current[i] = playing ? 0 : 30 + Math.sin(now * 1.3 + i * 0.45) * 18 + Math.sin(now * 3 + i) * 8;
        }
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
      setError(e?.message || "Audio failed");
      setPlaying(false);
    }
  }, [ensureGraph]);

  // Cleanup
  useEffect(() => () => {
    try { sourceRef.current?.disconnect?.(); } catch {}
    try { analyserRef.current?.disconnect?.(); } catch {}
    try { ctxRef.current?.close?.(); } catch {}
  }, []);

  return { audioRef, playing, toggle, dataRef: binBufferRef, error };
}
