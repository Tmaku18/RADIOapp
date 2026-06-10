/** Overlap duration when transitioning between radio tracks (all stations). */
export const RADIO_CROSSFADE_MS = 6000;

export function isCrossfadeSupportedUrl(url: string): boolean {
  return !url.includes('.m3u8');
}

export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  );
}

type CrossfadeOptions = {
  durationMs?: number;
  targetVolume: number;
  onComplete: () => void;
  onCancel?: () => void;
};

/**
 * Linear volume crossfade between two HTMLAudioElements.
 * Returns a cancel function.
 */
export function runAudioCrossfade(
  outgoing: HTMLAudioElement,
  incoming: HTMLAudioElement,
  options: CrossfadeOptions,
): () => void {
  const durationMs = options.durationMs ?? RADIO_CROSSFADE_MS;
  const targetVolume = Math.max(0, Math.min(1, options.targetVolume));
  const start = performance.now();
  let rafId = 0;
  let cancelled = false;

  incoming.volume = 0;
  incoming.muted = targetVolume <= 0.001;

  const tick = (now: number) => {
    if (cancelled) return;
    const elapsed = now - start;
    const t = Math.min(1, elapsed / durationMs);
    const outVol = targetVolume * (1 - t);
    const inVol = targetVolume * t;

    if (!isIosSafari()) {
      outgoing.volume = outVol;
      outgoing.muted = outVol <= 0.001;
      incoming.volume = inVol;
      incoming.muted = inVol <= 0.001;
    }

    if (t >= 1) {
      options.onComplete();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(rafId);
    options.onCancel?.();
  };
}
