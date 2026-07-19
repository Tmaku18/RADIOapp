/**
 * Safari real-FFT tap.
 *
 * Safari can't read frequency data from the primary <audio> element:
 * - `HTMLMediaElement.captureStream()` is unsupported in WebKit, and
 * - routing the primary element through `createMediaElementSource` silences
 *   playback whenever the AudioContext suspends.
 *
 * To still drive a music-reactive equalizer, we play a SEPARATE, silent audio
 * element loaded from the same URL and tap it through Web Audio. The primary
 * element keeps playing natively, so audio can never break — worst case the tap
 * yields no data and the caller falls back to simulated bars.
 *
 * Cost: the analysis element re-downloads the audio (≈2× bandwidth). We only
 * use this on desktop Safari (never iOS/mobile) and only while playing.
 */

export type SafariFftTap = {
  /**
   * Must be called from within a user gesture (click/tap). Safari only lets an
   * AudioContext resume — and an audible element start — inside a gesture, so
   * this creates+resumes the context and unlocks the analysis element for the
   * session. Safe to call on every gesture (idempotent).
   */
  prime(): void;
  /** Point the analysis element at the active track URL (idempotent). */
  ensureUrl(url: string): void;
  /** Follow the primary element's play state and position. */
  sync(primary: HTMLMediaElement | null, playing: boolean): void;
  /** The tap's AnalyserNode, or null until wired. */
  analyser(): AnalyserNode | null;
  /** Stop and detach (keeps the graph for reuse). */
  reset(): void;
  destroy(): void;
};

const DRIFT_TOLERANCE_SECONDS = 0.35;
const RESYNC_MIN_INTERVAL_MS = 1000;

export function createSafariFftTap(ctxRef: {
  current: AudioContext | null;
}): SafariFftTap {
  let el: HTMLAudioElement | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let an: AnalyserNode | null = null;
  let gain: GainNode | null = null;
  let currentUrl: string | null = null;
  let lastResyncAt = 0;
  let primed = false;
  let unlocked = false;

  const ensureElement = (): HTMLAudioElement | null => {
    if (typeof window === 'undefined') return null;
    if (el) return el;
    el = document.createElement('audio');
    // CORS-clean so the FFT can read samples (storage returns ACAO:*).
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', 'true');
    (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    // Kept out of the DOM; audio is routed entirely through Web Audio (gain 0).
    return el;
  };

  const ensureGraph = (): AnalyserNode | null => {
    const element = ensureElement();
    if (!element) return null;
    if (an) return an;
    if (!ctxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    try {
      // createMediaElementSource may be called only once per element, so the
      // graph is built once and reused across track changes.
      source = ctx.createMediaElementSource(element);
      an = ctx.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.62;
      gain = ctx.createGain();
      gain.gain.value = 0; // Silent: the primary element provides audible audio.
      source.connect(an);
      an.connect(gain);
      gain.connect(ctx.destination);
    } catch {
      an = null;
      source = null;
      gain = null;
    }
    return an;
  };

  const resumeCtx = () => {
    if (ctxRef.current?.state === 'suspended') {
      void ctxRef.current.resume().catch(() => undefined);
    }
  };

  /**
   * Start the (silent) analysis element. Safari blocks play() on an audible
   * element outside a gesture, so briefly mute to guarantee the start, then
   * unmute — the audio never reaches speakers (gain 0) but the analyser needs
   * unmuted samples to produce real FFT data.
   */
  const startPlayback = (element: HTMLAudioElement) => {
    if (!element.src || !element.paused) return;
    // Once unlocked, play unmuted directly — unmuting after a non-gesture muted
    // autoplay can make Safari re-pause the element.
    if (unlocked) {
      void element.play().catch(() => undefined);
      return;
    }
    element.muted = true;
    const started = element.play();
    const done = () => {
      unlocked = true;
      element.muted = false;
    };
    if (started && typeof started.then === 'function') {
      started.then(done).catch(() => {
        element.muted = false;
      });
    } else {
      done();
    }
  };

  return {
    prime() {
      const element = ensureElement();
      if (!element) return;
      ensureGraph();
      resumeCtx();
      primed = true;
      startPlayback(element);
    },

    ensureUrl(url: string) {
      const element = ensureElement();
      if (!element || !url || url === currentUrl) return;
      currentUrl = url;
      element.src = url;
      try {
        element.load();
      } catch {
        /* ignore */
      }
      // If a gesture already unlocked us, get the new track flowing so the tap
      // has data ready without waiting for the next resync.
      if (primed) {
        ensureGraph();
        resumeCtx();
        startPlayback(element);
      }
    },

    sync(primary, playing) {
      const element = el;
      if (!element || !primary) return;

      if (!playing) {
        if (!element.paused) element.pause();
        return;
      }

      ensureGraph();
      resumeCtx();

      const now = Date.now();
      const drift = Math.abs((element.currentTime || 0) - (primary.currentTime || 0));
      if (drift > DRIFT_TOLERANCE_SECONDS && now - lastResyncAt > RESYNC_MIN_INTERVAL_MS) {
        lastResyncAt = now;
        try {
          element.currentTime = primary.currentTime || 0;
        } catch {
          /* seek can throw on partial buffers */
        }
      }

      if (element.paused) {
        startPlayback(element);
      }
    },

    analyser() {
      return an;
    },

    reset() {
      currentUrl = null;
      if (!el) return;
      try {
        el.pause();
        el.removeAttribute('src');
        el.load();
      } catch {
        /* ignore */
      }
    },

    destroy() {
      try {
        source?.disconnect();
        an?.disconnect();
        gain?.disconnect();
      } catch {
        /* ignore */
      }
      if (el) {
        try {
          el.pause();
          el.removeAttribute('src');
        } catch {
          /* ignore */
        }
      }
      source = null;
      an = null;
      gain = null;
      el = null;
      currentUrl = null;
      primed = false;
      unlocked = false;
    },
  };
}
