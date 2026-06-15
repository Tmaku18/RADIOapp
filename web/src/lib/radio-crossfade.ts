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
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let finished = false;

  incoming.volume = 0;
  incoming.muted = targetVolume <= 0.001;

  const clearTimers = () => {
    cancelAnimationFrame(rafId);
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
  };

  // Complete the crossfade exactly once. This is invoked both by the normal
  // rAF ramp and by a safety timer, because requestAnimationFrame is paused in
  // background/hidden tabs — without the timer the swap would never happen and
  // the player would jam mid-transition.
  const finish = () => {
    if (cancelled || finished) return;
    finished = true;
    clearTimers();
    if (!isIosSafari()) {
      outgoing.volume = 0;
      outgoing.muted = true;
      incoming.volume = targetVolume;
      incoming.muted = targetVolume <= 0.001;
    }
    options.onComplete();
  };

  const tick = (now: number) => {
    if (cancelled || finished) return;
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
      finish();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
  // Guarantee completion even when rAF is throttled or fully paused (hidden tab).
  safetyTimer = setTimeout(finish, durationMs + 250);

  return () => {
    if (cancelled || finished) return;
    cancelled = true;
    clearTimers();
    options.onCancel?.();
  };
}
