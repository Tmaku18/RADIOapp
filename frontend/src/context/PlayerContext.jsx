import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { trendingSongs } from "@/data/mockData";

const STREAM_URL = process.env.REACT_APP_RADIO_STREAM_URL || "";
const BARS = 32;

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(72);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rawDataRef = useRef(new Uint8Array(BARS * 4));
  const barsRef = useRef(new Uint8Array(BARS)); // shared by all visualizers
  const bassRef = useRef(0); // 0..1 — averaged energy of lowest 4 bins

  // Build the Web Audio graph lazily on first user gesture
  const ensureGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (!sourceRef.current) {
      try {
        sourceRef.current = ctx.createMediaElementSource(audio);
        const an = ctx.createAnalyser();
        an.fftSize = Math.max(64, BARS * 4);
        an.smoothingTimeConstant = 0.78;
        sourceRef.current.connect(an);
        an.connect(ctx.destination);
        analyserRef.current = an;
        rawDataRef.current = new Uint8Array(an.frequencyBinCount);
      } catch (e) {
        // Source can only be created once per element — safe to ignore on remount
      }
    }
    if (ctx.state === "suspended") ctx.resume();
  }, []);

  // rAF loop: sample analyser into the shared bars buffer (or idle synthetic motion)
  useEffect(() => {
    let raf;
    const tick = () => {
      const an = analyserRef.current;
      if (an && playing) {
        an.getByteFrequencyData(rawDataRef.current);
        const N = rawDataRef.current.length;
        for (let i = 0; i < BARS; i++) {
          const t0 = i / BARS;
          const t1 = (i + 1) / BARS;
          const s = Math.floor(Math.pow(t0, 1.6) * N);
          const e = Math.max(s + 1, Math.floor(Math.pow(t1, 1.6) * N));
          let sum = 0;
          for (let j = s; j < e && j < N; j++) sum += rawDataRef.current[j];
          barsRef.current[i] = sum / Math.max(1, e - s);
        }
      } else {
        const now = performance.now() / 1000;
        for (let i = 0; i < BARS; i++) {
          barsRef.current[i] = 28 + Math.sin(now * 1.3 + i * 0.45) * 14 + Math.sin(now * 3 + i) * 6;
        }
      }
      // Update bass energy (lowest 4 bins → normalized 0..1, smoothed)
      const b = (barsRef.current[0] + barsRef.current[1] + barsRef.current[2] + barsRef.current[3]) / 4 / 255;
      bassRef.current = bassRef.current * 0.7 + b * 0.3;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Sync volume → audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume]);

  // Track audio playback state on the element (handles stalls, network drops, etc.)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setError(a.error?.message || "Stream error");
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("error", onError);
    };
  }, []);

  // Synthetic progress while streaming (a live stream has no duration — fake a 3min loop)
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setProgress((p) => (p >= 100 ? 0 : p + 0.3)), 250);
    return () => clearInterval(id);
  }, [playing]);

  const song = trendingSongs[idx];

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        ensureGraph();
        await audio.play();
        setError(null);
      } else {
        audio.pause();
      }
    } catch (e) {
      setError(e?.message || "Audio failed");
      setPlaying(false);
    }
  }, [ensureGraph]);

  const next = useCallback(() => setIdx((i) => (i + 1) % trendingSongs.length), []);
  const prev = useCallback(() => setIdx((i) => (i - 1 + trendingSongs.length) % trendingSongs.length), []);

  return (
    <PlayerContext.Provider
      value={{
        idx, setIdx, song,
        playing, toggle, setPlaying,
        volume, setVolume, progress,
        next, prev,
        barsRef, bassRef, audioRef,
        streamUrl: STREAM_URL,
        error,
      }}
    >
      {/* Single persistent audio element — never unmounts, no playback interruptions on route change */}
      <audio
        ref={audioRef}
        src={STREAM_URL}
        crossOrigin="anonymous"
        preload="none"
        data-testid="global-audio"
        className="hidden"
      />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
