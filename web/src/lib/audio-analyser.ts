export const ANALYSER_BARS = 32;

export function createAnalyserBarsBuffer(bars = ANALYSER_BARS): Uint8Array {
  return new Uint8Array(bars);
}

export function reduceFrequencyBins(
  raw: Uint8Array,
  bars: Uint8Array,
): void {
  const N = raw.length;
  for (let i = 0; i < bars.length; i++) {
    const t0 = i / bars.length;
    const t1 = (i + 1) / bars.length;
    const s = Math.floor(Math.pow(t0, 1.6) * N);
    const e = Math.max(s + 1, Math.floor(Math.pow(t1, 1.6) * N));
    let sum = 0;
    for (let j = s; j < e && j < N; j++) sum += raw[j];
    bars[i] = sum / Math.max(1, e - s);
  }
}

export function fillIdleBars(bars: Uint8Array, nowSec: number): void {
  for (let i = 0; i < bars.length; i++) {
    bars[i] =
      28 +
      Math.sin(nowSec * 1.3 + i * 0.45) * 14 +
      Math.sin(nowSec * 3 + i) * 6;
  }
}

/**
 * Music-like spectrum used when a real FFT tap is unavailable (mobile web has no
 * captureStream, and routing through createMediaElementSource breaks playback).
 * Bass-heavy on the left, beat pulse, per-bar wobble — looks alive while playing.
 */
export function fillSimulatedBars(bars: Uint8Array, nowSec: number): void {
  const n = bars.length;
  // Sharp, kick-like beat (raised sine) plus a half-time pulse for variety.
  const kick = Math.pow(0.5 + 0.5 * Math.sin(nowSec * 5.6), 2.2);
  const kick2 = Math.pow(0.5 + 0.5 * Math.sin(nowSec * 2.3 + 1.1), 1.6);
  const beat = 0.65 * kick + 0.35 * kick2;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.pow(1 - t, 0.8);
    const wob =
      0.5 +
      0.4 * Math.sin(nowSec * 11 + i * 0.7) +
      0.3 * Math.sin(nowSec * 4.1 + i * 1.9);
    // Low floor + big beat swing = dramatic jumps on every kick.
    let v = env * (0.12 + 0.95 * beat) * wob;
    v = Math.max(0.05, Math.min(1, v));
    bars[i] = v * 255;
  }
}

/**
 * Punch up FFT bars for a more dramatic, beat-reactive visualizer while keeping
 * EVERY bar movable. Bass bins carry the most energy in music, so a large gain
 * pins the left half at max (flat, "not moving"). Instead we treat the whole
 * spectrum: a high-frequency "tilt" lifts the quieter right side, a gentle
 * contrast curve adds punch, and a moderate gain leaves headroom so loud bass
 * still visibly swings on each beat instead of clamping.
 * Mutates [bars] in place; all-zero input stays zero (so dead-tap detection works).
 */
export function dramatizeBars(bars: Uint8Array): void {
  const n = bars.length;
  for (let i = 0; i < n; i++) {
    const raw = bars[i];
    if (raw === 0) continue;
    const t = i / n;
    // Lift the high end (right side) so treble bars aren't tiny; leave the bass
    // alone so it keeps room to move rather than saturating.
    const tilt = 1 + 0.9 * Math.pow(t, 1.3);
    const v = (raw / 255) * tilt;
    // Contrast curve (gamma < 1 lifts mids) with unity gain — leaves headroom so
    // even loud bass rises and falls instead of pinning at the ceiling.
    const out = Math.pow(Math.min(1, v), 0.72);
    bars[i] = Math.min(1, out) * 255;
  }
}

export function updateBassRef(
  bars: Uint8Array,
  bassRef: { current: number },
): void {
  const b = (bars[0] + bars[1] + bars[2] + bars[3]) / 4 / 255;
  // Punchier: amplified target with a fast attack and a little release so the
  // artwork/glow pulse visibly kicks on every beat.
  const target = Math.min(1, b * 1.35);
  const attack = target > bassRef.current ? 0.6 : 0.32;
  bassRef.current = bassRef.current * (1 - attack) + target * attack;
}

type CapturableMediaElement = HTMLMediaElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
  webkitCaptureStream?: () => MediaStream;
};

export type AnalyserSlot = {
  source?: MediaElementAudioSourceNode | MediaStreamAudioSourceNode;
  analyser?: AnalyserNode;
  /** Element this tap is bound to. */
  mediaElement?: HTMLMediaElement;
  /** `currentSrc` when the tap was last wired (reconnect after track changes). */
  mediaSrc?: string;
  /** True when routed through createMediaElementSource (visible-tab fallback). */
  usesElementSource?: boolean;
};

function mediaElementSrc(audio: HTMLMediaElement): string {
  return audio.currentSrc || audio.src || '';
}

function captureMediaElementStream(audio: HTMLMediaElement): MediaStream | null {
  const el = audio as CapturableMediaElement;
  if (typeof el.captureStream === 'function') {
    return el.captureStream();
  }
  if (typeof el.webkitCaptureStream === 'function') {
    return el.webkitCaptureStream();
  }
  if (typeof el.mozCaptureStream === 'function') {
    return el.mozCaptureStream();
  }
  return null;
}

function wireAnalyserTap(
  audio: HTMLMediaElement,
  slot: AnalyserSlot,
  ctx: AudioContext,
  an: AnalyserNode,
): boolean {
  if (shouldUseDirectMediaPlayback()) {
    const stream = captureMediaElementStream(audio);
    if (stream) {
      slot.source = ctx.createMediaStreamSource(stream);
      slot.source.connect(an);
      slot.usesElementSource = false;
      return true;
    }
    // Desktop fallback when captureStream is missing or returns a silent tap
    // (common with some CDN/CORS setups). Mobile stays native-only so
    // background playback and lock-screen audio are not hijacked.
    if (!isMobileWeb()) {
      return wireElementSourceTap(audio, slot, ctx, an);
    }
    return false;
  }

  return wireElementSourceTap(audio, slot, ctx, an);
}

function wireElementSourceTap(
  audio: HTMLMediaElement,
  slot: AnalyserSlot,
  ctx: AudioContext,
  an: AnalyserNode,
): boolean {
  slot.source = ctx.createMediaElementSource(audio);
  slot.source.connect(an);
  an.connect(ctx.destination);
  slot.usesElementSource = true;
  return true;
}

export function disconnectAnalyserSlot(slot: AnalyserSlot): void {
  try {
    slot.source?.disconnect();
  } catch {
    /* ignore */
  }
  try {
    slot.analyser?.disconnect();
  } catch {
    /* ignore */
  }
  slot.source = undefined;
  slot.analyser = undefined;
  slot.mediaElement = undefined;
  slot.mediaSrc = undefined;
  slot.usesElementSource = undefined;
}

/** iOS Safari requires inline playback and often blocks audio until a user gesture. */
export function configureMobileAudioElement(audio: HTMLAudioElement): void {
  audio.preload = 'auto';
  // Desktop FFT taps need CORS; on mobile web, anonymous mode can block playback on
  // some CDN edges when headers are missing — native playback does not need it.
  if (!isMobileWeb()) {
    audio.crossOrigin = 'anonymous';
  }
  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', 'true');
  (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  audio.setAttribute('x-webkit-airplay', 'allow');
}

export function isMobileWeb(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  );
}

/**
 * Radio playback must use the native HTMLAudioElement output path so background
 * tabs, lock screen, and mobile browser audio keep working. Web Audio analyser
 * routing (createMediaElementSource) disconnects default output and goes silent
 * when AudioContext is suspended in background.
 */
export function shouldUseDirectMediaPlayback(): boolean {
  return true;
}

export async function unlockWebAudioContext(
  ctxRef: { current: AudioContext | null },
): Promise<boolean> {
  const ctx = ctxRef.current;
  if (!ctx) return true;
  if (ctx.state === 'running') return true;
  try {
    await ctx.resume();
    return true;
  } catch {
    return false;
  }
}

/** Resume Web Audio (required on iOS when using MediaElementSource) then play. */
export function isPlaybackNotAllowedError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return error.name === 'NotAllowedError';
}

export async function playMediaElement(
  audio: HTMLAudioElement,
  ctxRef: { current: AudioContext | null },
): Promise<void> {
  if (!shouldUseDirectMediaPlayback()) {
    await unlockWebAudioContext(ctxRef);
  } else if (ctxRef.current?.state === 'suspended') {
    // Harmless when analyser is unwired; keeps any existing tap from going silent.
    await unlockWebAudioContext(ctxRef);
  }
  await audio.play();
}

export function ensureMediaElementAnalyser(
  audio: HTMLAudioElement,
  slot: AnalyserSlot,
  ctxRef: { current: AudioContext | null },
  fftSize: number,
  opts?: { forceRefresh?: boolean; preferElementSource?: boolean },
): AnalyserNode | null {
  if (typeof window === 'undefined') return null;

  const src = mediaElementSrc(audio);
  if (!src) return slot.analyser ?? null;

  if (!opts?.forceRefresh && slot.analyser && slot.mediaElement === audio && slot.mediaSrc === src) {
    void unlockWebAudioContext(ctxRef);
    return slot.analyser;
  }

  if (slot.source || slot.analyser) {
    disconnectAnalyserSlot(slot);
  }

  if (!ctxRef.current) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctxRef.current = new Ctx();
  }
  const ctx = ctxRef.current;

  try {
    const an = ctx.createAnalyser();
    an.fftSize = Math.max(64, fftSize);
    // Lower smoothing = snappier, more dramatic reaction to beats/transients.
    an.smoothingTimeConstant = 0.62;

    const wired =
      opts?.preferElementSource && !isMobileWeb()
        ? wireElementSourceTap(audio, slot, ctx, an)
        : wireAnalyserTap(audio, slot, ctx, an);

    if (!wired) {
      disconnectAnalyserSlot(slot);
      return null;
    }

    slot.analyser = an;
    slot.mediaElement = audio;
    slot.mediaSrc = src;
  } catch {
    disconnectAnalyserSlot(slot);
    return null;
  }

  void unlockWebAudioContext(ctxRef);
  return slot.analyser ?? null;
}

/** Rebuild the FFT tap after a new `src` loads or playback resumes. */
export function refreshMediaElementAnalyser(
  audio: HTMLAudioElement,
  slot: AnalyserSlot,
  ctxRef: { current: AudioContext | null },
  fftSize: number,
  opts?: { preferElementSource?: boolean },
): AnalyserNode | null {
  return ensureMediaElementAnalyser(audio, slot, ctxRef, fftSize, {
    forceRefresh: true,
    preferElementSource: opts?.preferElementSource,
  });
}
