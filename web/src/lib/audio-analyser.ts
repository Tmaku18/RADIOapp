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

export function updateBassRef(
  bars: Uint8Array,
  bassRef: { current: number },
): void {
  const b =
    (bars[0] + bars[1] + bars[2] + bars[3]) / 4 / 255;
  bassRef.current = bassRef.current * 0.7 + b * 0.3;
}

export type AnalyserSlot = {
  source?: MediaElementAudioSourceNode;
  analyser?: AnalyserNode;
};

export function ensureMediaElementAnalyser(
  audio: HTMLAudioElement,
  slot: AnalyserSlot,
  ctxRef: { current: AudioContext | null },
  fftSize: number,
): AnalyserNode | null {
  if (typeof window === 'undefined') return null;
  if (!ctxRef.current) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctxRef.current = new Ctx();
  }
  const ctx = ctxRef.current;
  if (!slot.source) {
    try {
      slot.source = ctx.createMediaElementSource(audio);
      const an = ctx.createAnalyser();
      an.fftSize = Math.max(64, fftSize);
      an.smoothingTimeConstant = 0.78;
      slot.source.connect(an);
      an.connect(ctx.destination);
      slot.analyser = an;
    } catch {
      return slot.analyser ?? null;
    }
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return slot.analyser ?? null;
}
