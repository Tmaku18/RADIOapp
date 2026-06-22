'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import Hls from 'hls.js';
import type { PlaybackSource, PlaybackState, PlaybackTrack } from './types';
import { initialPlaybackState } from './types';
import {
  isCrossfadeSupportedUrl,
  isIosSafari,
  RADIO_CROSSFADE_MS,
  runAudioCrossfade,
} from '@/lib/radio-crossfade';
import { radioApi } from '@/lib/api';
import {
  applyDuckToMain,
  syncOverlayHls,
  applyOverlayVolume,
  playSoundboardClipOnOverlay,
  type DjBoothEvent,
  type DjOverlayState,
} from '@/lib/dj-booth-listener';
import { resolveTrackArtworkUrl } from '@/lib/media-artwork';
import { setLastRadioStationId } from '@/lib/playback-preferences';
import {
  ANALYSER_BARS,
  configureMobileAudioElement,
  createAnalyserBarsBuffer,
  ensureMediaElementAnalyser,
  fillIdleBars,
  playMediaElement,
  reduceFrequencyBins,
  unlockWebAudioContext,
  updateBassRef,
  type AnalyserSlot,
} from '@/lib/audio-analyser';

type PlaybackActions = {
  /**
   * Load and optionally play a track. Stops any current playback (single session rule).
   * `seekSeconds` joins the listener at the radio's live position (true-radio sync)
   * so every device plays the same song at the same offset.
   */
  loadTrack: (
    track: PlaybackTrack,
    source: PlaybackSource,
    autoPlay?: boolean,
    seekSeconds?: number | null,
  ) => void;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  setVolume: (vol: number) => void;
  seek: (time: number) => void;
  clearError: () => void;
  /** Radio: sync to server position */
  syncToPosition: (positionSeconds: number) => void;
  /** Radio: soft pause (DVR buffer) */
  softPause: () => void;
  /** Radio: resume from soft pause */
  softResume: () => Promise<void>;
  /** Radio: jump to live position */
  jumpToLive: (positionSeconds: number) => Promise<void>;
  /** Radio: true if paused > 30s */
  needsJumpToLive: () => boolean;
  /** Stop and clear current track */
  stop: () => void;
  /** Apply global DJ booth transport + mic overlay from server */
  applyServerBoothState: (opts: {
    transportPaused?: boolean;
    djOverlay?: DjOverlayState | null;
  }) => void;
  handleDjBoothEvent: (event: DjBoothEvent) => void;
};

type PlaybackContextValue = {
  state: PlaybackState;
  actions: PlaybackActions;
  /** Register callback when track ends (e.g. radio fetches next). Called only when source === 'radio'. */
  setOnRadioTrackEnded: (cb: (() => void) | null) => void;
  /** True while a full RadioPlayer surface is mounted (listen page or expanded bar). */
  radioPlayerUiActive: boolean;
  /** Call on mount; returned function unregisters on unmount. */
  registerRadioPlayerUi: () => () => void;
  /**
   * True when the server's reported "current" track is one we already crossfaded
   * past (server hasn't rotated yet). Pollers use this to avoid jumping backward.
   */
  isStaleRadioServerTrack: (trackId: string | null | undefined) => boolean;
  /** Live FFT bar heights (0–255), updated each animation frame. */
  barsRef: MutableRefObject<Uint8Array>;
  /** Smoothed bass energy 0..1 from lowest FFT bins. */
  bassRef: MutableRefObject<number>;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error('usePlayback must be used within PlaybackProvider');
  }
  return ctx;
}

export function usePlaybackOptional() {
  return useContext(PlaybackContext);
}

interface PlaybackProviderProps {
  children: ReactNode;
}

type AudioSlot = 'a' | 'b';

function applyVolumeToAudio(audio: HTMLAudioElement, vol: number) {
  const v = Math.max(0, Math.min(1, vol));
  if (isIosSafari()) {
    audio.volume = 1;
    audio.muted = v <= 0.001;
  } else {
    audio.volume = v;
    audio.muted = v <= 0.001;
  }
}

export function PlaybackProvider({ children }: PlaybackProviderProps) {
  const LIVE_SYNC_FORWARD_SEEK_THRESHOLD_SEC = 8;
  const LIVE_SYNC_BACKWARD_SEEK_THRESHOLD_SEC = 12;
  const LIVE_SYNC_SEEK_COOLDOWN_MS = 30000;
  const [state, setState] = useState<PlaybackState>(initialPlaybackState);
  // Mirror of the latest state for use inside event handlers (e.g. visibility
  // recovery) without re-subscribing the listener on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;
  const audioPairRef = useRef<{ a: HTMLAudioElement; b: HTMLAudioElement } | null>(null);
  const activeSlotRef = useRef<AudioSlot>('a');
  const hlsBySlotRef = useRef<{ a: Hls | null; b: Hls | null }>({ a: null, b: null });
  const onRadioTrackEndedRef = useRef<(() => void) | null>(null);
  const sourceRef = useRef<PlaybackSource>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRetriedAfterErrorRef = useRef(false);
  const lastSyncSeekAtRef = useRef(0);
  const autoPlayPendingRef = useRef(false);
  const isLoadingTrackRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const trackIdRef = useRef<string | null>(null);
  const trackRadioIdRef = useRef<string | null>(null);
  const volumeRef = useRef(1);
  const crossfadeCancelRef = useRef<(() => void) | null>(null);
  const isCrossfadingRef = useRef(false);
  const crossfadeIncomingSlotRef = useRef<AudioSlot | null>(null);
  const crossfadePrefetchTrackIdRef = useRef<string | null>(null);
  // When a crossfade prefetch (via /radio/peek) advances us to the upcoming
  // song before it ends, the server still reports the *previous* song as
  // current for a few seconds. We record what we advanced away from so pollers
  // don't revert to it (which would jump the listener backward = skipping).
  const recentlyAdvancedFromRef = useRef<{ id: string; at: number } | null>(null);
  const isCrossfadePrefetchingRef = useRef(false);
  const overlayAudioRef = useRef<HTMLAudioElement | null>(null);
  const overlayHlsRef = useRef<Hls | null>(null);
  const djOverlayRef = useRef<DjOverlayState | null>(null);
  const globalTransportPausedRef = useRef(false);
  // True when the listener muted the radio via the pause button. The stream
  // keeps playing/advancing and stays synced to live; only output is silenced.
  const mutedByUserRef = useRef(false);
  const radioPlayerUiCountRef = useRef(0);
  const [radioPlayerUiActive, setRadioPlayerUiActive] = useState(false);
  const barsRef = useRef(createAnalyserBarsBuffer(ANALYSER_BARS));
  const bassRef = useRef(0);
  const rawAnalyserDataRef = useRef(new Uint8Array(ANALYSER_BARS * 4));
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const analyserSlotsRef = useRef<{ a: AnalyserSlot; b: AnalyserSlot }>({
    a: {},
    b: {},
  });
  const playAudioRef = useRef<(audio: HTMLAudioElement) => Promise<void>>(() =>
    Promise.resolve(),
  );
  playAudioRef.current = (audio) => playMediaElement(audio, analyserCtxRef);

  const playAudio = useCallback((audio: HTMLAudioElement) => playAudioRef.current(audio), []);

  const notifyUserPlaybackGesture = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('radio:user-playback-gesture'));
  }, []);

  const registerRadioPlayerUi = useCallback(() => {
    radioPlayerUiCountRef.current += 1;
    setRadioPlayerUiActive(true);
    return () => {
      radioPlayerUiCountRef.current = Math.max(0, radioPlayerUiCountRef.current - 1);
      setRadioPlayerUiActive(radioPlayerUiCountRef.current > 0);
    };
  }, []);

  const getActiveAudio = useCallback(() => {
    const pair = audioPairRef.current;
    if (!pair) return null;
    return pair[activeSlotRef.current];
  }, []);

  const getInactiveAudio = useCallback(() => {
    const pair = audioPairRef.current;
    if (!pair) return null;
    return activeSlotRef.current === 'a' ? pair.b : pair.a;
  }, []);

  const getOverlayController = useCallback(() => {
    const overlay = overlayAudioRef.current;
    if (!overlay) return null;
    return {
      overlayAudio: overlay,
      hlsRef: overlayHlsRef,
      userVolume: volumeRef.current,
      duckVolume: djOverlayRef.current?.duckVolume ?? 0.25,
      micActive: !!djOverlayRef.current?.active,
    };
  }, []);

  const refreshMainVolume = useCallback(() => {
    const main = getActiveAudio();
    const ctrl = getOverlayController();
    if (mutedByUserRef.current || stateRef.current.pausedAt != null) {
      if (main) {
        main.volume = 0;
        main.muted = true;
      }
      const inactive = getInactiveAudio();
      if (inactive) {
        inactive.volume = 0;
        inactive.muted = true;
      }
      return;
    }
    if (main && ctrl) applyDuckToMain(main, volumeRef.current, ctrl);
    else if (main) applyVolumeToAudio(main, volumeRef.current);
    if (ctrl) applyOverlayVolume(ctrl, ctrl.micActive);
  }, [getActiveAudio, getInactiveAudio, getOverlayController]);

  const applyServerBoothState = useCallback(
    (opts: { transportPaused?: boolean; djOverlay?: DjOverlayState | null }) => {
      // A user mute keeps the stream live (we just silence output), so admin
      // transport changes should still drive playback while muted. Only a
      // legacy hard pause (pausedAt) blocks an admin-initiated resume.
      const hardPaused = stateRef.current.pausedAt != null;
      const userSoftPaused = hardPaused || mutedByUserRef.current;

      if (typeof opts.transportPaused === 'boolean') {
        globalTransportPausedRef.current = opts.transportPaused;
        const pair = audioPairRef.current;
        if (opts.transportPaused) {
          pair?.a.pause();
          pair?.b.pause();
          setState((s) => ({ ...s, isPlaying: false }));
        } else if (
          sourceRef.current === 'radio' &&
          !hardPaused &&
          stateRef.current.isPlaying
        ) {
          // Admin lifted a global transport pause — do not resume when the
          // listener hard-paused or is not playing. If the listener has muted,
          // keep the stream live but silent.
          const main = getActiveAudio();
          if (main && main.paused) {
            void playAudio(main).catch(() => undefined);
            if (mutedByUserRef.current) refreshMainVolume();
            setState((s) => ({ ...s, isPlaying: true }));
          }
        }
      }
      if (opts.djOverlay !== undefined) {
        djOverlayRef.current = opts.djOverlay;
        const ctrl = getOverlayController();
        if (userSoftPaused) {
          const overlay = overlayAudioRef.current;
          overlay?.pause();
          if (overlay) {
            overlay.volume = 0;
            overlay.muted = true;
          }
          refreshMainVolume();
          return;
        }
        if (ctrl) {
          syncOverlayHls(ctrl, opts.djOverlay, true);
        }
        refreshMainVolume();
      }
    },
    [getActiveAudio, getOverlayController, playAudio, refreshMainVolume],
  );

  const handleDjBoothEvent = useCallback(
    (event: DjBoothEvent) => {
      if (event.type === 'transport_pause') {
        applyServerBoothState({ transportPaused: true });
      } else if (event.type === 'transport_play') {
        applyServerBoothState({ transportPaused: false });
      } else if (event.type === 'mic_on') {
        applyServerBoothState({
          djOverlay: {
            active: true,
            hlsUrl: event.hlsUrl ?? djOverlayRef.current?.hlsUrl ?? null,
            duckVolume: event.duckVolume,
          },
        });
      } else if (event.type === 'mic_off') {
        applyServerBoothState({
          djOverlay: {
            active: false,
            hlsUrl: djOverlayRef.current?.hlsUrl ?? null,
            duckVolume: djOverlayRef.current?.duckVolume ?? 0.25,
          },
        });
      } else if (event.type === 'duck_volume') {
        if (djOverlayRef.current) {
          djOverlayRef.current.duckVolume = event.duckVolume;
          refreshMainVolume();
        }
      } else if (event.type === 'soundboard_play') {
        const ctrl = getOverlayController();
        const main = getActiveAudio();
        if (ctrl) {
          void playSoundboardClipOnOverlay(
            ctrl,
            event.clipUrl,
            event.durationSeconds,
            main,
            volumeRef.current,
          );
        }
      }
    },
    [applyServerBoothState, getActiveAudio, getOverlayController, refreshMainVolume],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const overlay = new Audio();
    configureMobileAudioElement(overlay);
    overlayAudioRef.current = overlay;
    return () => {
      overlay.pause();
      if (overlayHlsRef.current) {
        overlayHlsRef.current.destroy();
        overlayHlsRef.current = null;
      }
      overlayAudioRef.current = null;
    };
  }, []);

  const getInactiveSlot = useCallback((): AudioSlot => {
    return activeSlotRef.current === 'a' ? 'b' : 'a';
  }, []);

  const destroyHlsForSlot = useCallback((slot: AudioSlot) => {
    const hls = hlsBySlotRef.current[slot];
    if (hls) {
      hls.destroy();
      hlsBySlotRef.current[slot] = null;
    }
  }, []);

  const clearAudioSlot = useCallback(
    (slot: AudioSlot) => {
      const pair = audioPairRef.current;
      if (!pair) return;
      const audio = pair[slot];
      audio.pause();
      destroyHlsForSlot(slot);
      audio.removeAttribute('src');
      audio.load();
    },
    [destroyHlsForSlot],
  );

  const cancelCrossfade = useCallback(() => {
    crossfadeCancelRef.current?.();
    crossfadeCancelRef.current = null;
    isCrossfadingRef.current = false;
    crossfadeIncomingSlotRef.current = null;
  }, []);

  useEffect(() => {
    sourceRef.current = state.source;
  }, [state.source]);

  useEffect(() => {
    volumeRef.current = state.volume;
  }, [state.volume]);

  useEffect(() => {
    trackIdRef.current = state.track?.id ?? null;
  }, [state.track?.id]);

  useEffect(() => {
    trackRadioIdRef.current = state.track?.radioId ?? null;
    if (state.source === 'radio' && state.track?.radioId?.trim()) {
      setLastRadioStationId(state.track.radioId);
    }
  }, [state.source, state.track?.radioId]);

  // Pause radio when discover clips, sample previews, or other page audio starts.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onExternalMediaPlay = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLMediaElement)) return;
      const pair = audioPairRef.current;
      if (pair && (target === pair.a || target === pair.b)) return;
      if (overlayAudioRef.current && target === overlayAudioRef.current) return;
      if (sourceRef.current !== 'radio') return;

      const main = getActiveAudio();
      if (!main || main.paused) return;

      cancelCrossfade();
      pair?.a.pause();
      pair?.b.pause();
      setState((s) => ({
        ...s,
        isPlaying: false,
        pausedAt: Date.now(),
        isLive: false,
      }));
    };

    document.addEventListener('play', onExternalMediaPlay, true);
    return () => document.removeEventListener('play', onExternalMediaPlay, true);
  }, [cancelCrossfade, getActiveAudio]);

  const setOnRadioTrackEnded = useCallback((cb: (() => void) | null) => {
    onRadioTrackEndedRef.current = cb;
  }, []);

  // True if `serverTrackId` is a song we just crossfaded away from within the
  // last few seconds. Pollers use this to avoid reverting to the server's
  // not-yet-rotated "current" track and jumping the listener backward.
  const isStaleRadioServerTrack = useCallback(
    (serverTrackId: string | null | undefined) => {
      if (!serverTrackId) return false;
      const adv = recentlyAdvancedFromRef.current;
      if (!adv || adv.id !== serverTrackId) return false;
      return Date.now() - adv.at < 12000;
    },
    [],
  );

  const attachSourceToSlot = useCallback(
    (
      slot: AudioSlot,
      url: string,
      seekSeconds: number | null,
      autoPlay: boolean,
      source: PlaybackSource,
    ) => {
      const pair = audioPairRef.current;
      if (!pair) return;
      const audio = pair[slot];

      destroyHlsForSlot(slot);
      audio.removeAttribute('src');
      audio.load();
      applyVolumeToAudio(audio, slot === activeSlotRef.current ? volumeRef.current : 0);

      const onReady = () => {
        if (seekSeconds !== null && seekSeconds > 0) {
          audio.currentTime = seekSeconds;
        }
        // Muted = stay live but silent: keep the stream playing so it never
        // drifts off the live position; just silence the output.
        if (mutedByUserRef.current) {
          audio.volume = 0;
          audio.muted = true;
          void playAudio(audio).catch(() => {});
          return;
        }
        if (stateRef.current.pausedAt != null) {
          audio.volume = 0;
          audio.muted = true;
          return;
        }
        if (autoPlay) {
          void playAudio(audio).catch(() => {});
        }
      };

      if (url.includes('.m3u8')) {
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(url);
          hls.attachMedia(audio);
          hls.on(Hls.Events.MANIFEST_PARSED, onReady);
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              setState((s) => ({ ...s, error: 'Stream error', isLoading: false }));
              if (source === 'radio' && onRadioTrackEndedRef.current) {
                onRadioTrackEndedRef.current();
              }
            }
          });
          hlsBySlotRef.current[slot] = hls;
        } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
          audio.src = url;
          audio.addEventListener('canplay', onReady, { once: true });
        } else {
          setState((s) => ({ ...s, error: 'HLS not supported', isLoading: false }));
        }
      } else {
        audio.src = url;
        if (autoPlay || mutedByUserRef.current) {
          audio.addEventListener(
            'canplay',
            () => {
              if (seekSeconds !== null && seekSeconds > 0) {
                audio.currentTime = seekSeconds;
              }
              // Stay live but silent while muted.
              if (mutedByUserRef.current) {
                audio.volume = 0;
                audio.muted = true;
              }
              void playAudio(audio).catch(() => {});
            },
            { once: true },
          );
        } else if (seekSeconds !== null && seekSeconds > 0) {
          audio.addEventListener(
            'canplay',
            () => {
              audio.currentTime = seekSeconds;
            },
            { once: true },
          );
        }
      }
    },
    [destroyHlsForSlot, playAudio],
  );

  // Dual audio elements and event wiring
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const wireAudio = (audio: HTMLAudioElement, slot: AudioSlot) => {
      applyVolumeToAudio(audio, slot === activeSlotRef.current ? volumeRef.current : 0);

      const onTimeUpdate = () => {
        if (activeSlotRef.current !== slot) return;
        setState((s) => ({ ...s, currentTime: audio.currentTime || 0 }));
      };
      const onDurationChange = () => {
        if (activeSlotRef.current !== slot) return;
        setState((s) => ({ ...s, duration: audio.duration || 0 }));
      };
      const onPlay = () => {
        if (activeSlotRef.current !== slot && !isCrossfadingRef.current) return;
        // Legacy hard pause: keep it stopped.
        if (stateRef.current.pausedAt != null) {
          audio.pause();
          audio.volume = 0;
          audio.muted = true;
          setState((s) => ({ ...s, isPlaying: false }));
          return;
        }
        // Muted: stream stays live, just silence output (don't pause).
        if (mutedByUserRef.current) {
          audio.volume = 0;
          audio.muted = true;
        }
        // Playback recovered — clear any stale "Failed to load audio" banner.
        setState((s) => ({ ...s, isPlaying: true, error: null }));
      };
      const onPause = () => {
        if (activeSlotRef.current !== slot || isLoadingTrackRef.current || isCrossfadingRef.current) {
          return;
        }
        // Browsers often pause <audio> in background tabs even though the listener
        // did not tap pause. For live radio, keep playback intent so refocus recovery
        // can resume (and muted listeners still need the stream advancing silently).
        if (
          sourceRef.current === 'radio' &&
          stateRef.current.pausedAt == null &&
          !globalTransportPausedRef.current
        ) {
          if (
            typeof document !== 'undefined' &&
            document.hidden &&
            !mutedByUserRef.current
          ) {
            void playAudioRef.current(audio).catch(() => undefined);
          }
          return;
        }
        setState((s) => ({ ...s, isPlaying: false }));
      };
      const clearLoadTimeout = () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
      };
      const onLoadStart = () => {
        if (activeSlotRef.current !== slot && !isCrossfadingRef.current) return;
        clearLoadTimeout();
        setState((s) => ({ ...s, isLoading: true }));
        loadTimeoutRef.current = setTimeout(() => {
          setState((s) => ({
            ...s,
            isLoading: false,
            error:
              s.error ?? 'Audio is taking too long to load. Skipping to next track…',
          }));
          if (sourceRef.current === 'radio' && onRadioTrackEndedRef.current) {
            onRadioTrackEndedRef.current();
          }
          // Mobile networks need more headroom, especially when joining a song
          // mid-way (the browser must buffer from the live offset before it can
          // play). 12s skipped good songs too eagerly; 20s is far more tolerant.
        }, 20000);
      };
      const onCanPlay = () => {
        if (activeSlotRef.current !== slot && crossfadeIncomingSlotRef.current !== slot) return;
        clearLoadTimeout();
        isLoadingTrackRef.current = false;
        const seekTo = pendingSeekRef.current;
        if (seekTo !== null && seekTo > 0 && activeSlotRef.current === slot) {
          pendingSeekRef.current = null;
          audio.currentTime = seekTo;
        }
        // Source loaded successfully — clear any stale error from a prior blip.
        setState((s) => ({ ...s, isLoading: false, error: null }));
        if (mutedByUserRef.current && activeSlotRef.current === slot) {
          // Stay live but silent — keep the stream advancing while muted.
          autoPlayPendingRef.current = false;
          audio.volume = 0;
          audio.muted = true;
          void playAudio(audio).catch(() => {});
          return;
        }
        if (autoPlayPendingRef.current && activeSlotRef.current === slot) {
          autoPlayPendingRef.current = false;
          if (stateRef.current.pausedAt != null) {
            audio.volume = 0;
            audio.muted = true;
            return;
          }
          void playAudio(audio).catch(() => {});
        }
      };
      const onError = () => {
        if (activeSlotRef.current !== slot && crossfadeIncomingSlotRef.current !== slot) return;
        clearLoadTimeout();
        isLoadingTrackRef.current = false;
        autoPlayPendingRef.current = false;
        const mediaError = audio.error;
        const isUnsupported =
          mediaError?.code === 4 || mediaError?.message?.includes('supported source');

        // Radio: transient mobile-network blips (MEDIA_ERR_NETWORK / decode)
        // are common and recover on a reload. Retry the SAME source once before
        // surfacing an error or skipping — otherwise flaky mobile connections
        // produce a stream of "Failed to load audio" banners and skip good songs.
        if (sourceRef.current === 'radio') {
          if (!hasRetriedAfterErrorRef.current) {
            hasRetriedAfterErrorRef.current = true;
            try {
              audio.load();
              const resumePos = stateRef.current.serverPosition || 0;
              const onRetryReady = () => {
                if (resumePos > 0) {
                  try { audio.currentTime = resumePos; } catch {}
                }
                if (mutedByUserRef.current) {
                  audio.volume = 0;
                  audio.muted = true;
                }
                void playAudio(audio).catch(() => onRadioTrackEndedRef.current?.());
              };
              audio.addEventListener('canplay', onRetryReady, { once: true });
            } catch {
              onRadioTrackEndedRef.current?.();
            }
            // Don't flash an error while the retry is in flight.
            return;
          }
          // Retry already failed — surface a transient message and advance.
          setState((s) => ({
            ...s,
            error: isUnsupported ? 'Audio source not available.' : 'Failed to load audio',
            isLoading: false,
          }));
          onRadioTrackEndedRef.current?.();
          return;
        }

        setState((s) => ({
          ...s,
          error: isUnsupported ? 'Audio source not available.' : 'Failed to load audio',
          isLoading: false,
        }));
      };
      const onEnded = () => {
        if (isCrossfadingRef.current) return;
        if (sourceRef.current === 'radio' && activeSlotRef.current === slot && onRadioTrackEndedRef.current) {
          onRadioTrackEndedRef.current();
        }
      };

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('durationchange', onDurationChange);
      audio.addEventListener('play', onPlay);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('loadstart', onLoadStart);
      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('error', onError);
      audio.addEventListener('ended', onEnded);

      return () => {
        clearLoadTimeout();
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('durationchange', onDurationChange);
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('loadstart', onLoadStart);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
        audio.removeEventListener('ended', onEnded);
      };
    };

    const audioA = new Audio();
    const audioB = new Audio();
    configureMobileAudioElement(audioA);
    configureMobileAudioElement(audioB);
    audioA.crossOrigin = 'anonymous';
    audioB.crossOrigin = 'anonymous';
    audioPairRef.current = { a: audioA, b: audioB };
    ensureMediaElementAnalyser(
      audioA,
      analyserSlotsRef.current.a,
      analyserCtxRef,
      ANALYSER_BARS * 4,
    );
    ensureMediaElementAnalyser(
      audioB,
      analyserSlotsRef.current.b,
      analyserCtxRef,
      ANALYSER_BARS * 4,
    );
    const cleanupA = wireAudio(audioA, 'a');
    const cleanupB = wireAudio(audioB, 'b');

    return () => {
      cancelCrossfade();
      cleanupA?.();
      cleanupB?.();
      audioA.pause();
      audioB.pause();
      audioPairRef.current = null;
      destroyHlsForSlot('a');
      destroyHlsForSlot('b');
    };
  }, [cancelCrossfade, destroyHlsForSlot]);

  // Unlock Web Audio on first touch — iOS routes playback through AudioContext
  // (MediaElementSource) and stays silent until the context is resumed.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const unlock = () => {
      void unlockWebAudioContext(analyserCtxRef);
    };
    const opts: AddEventListenerOptions = { once: true, passive: true, capture: true };
    document.addEventListener('touchstart', unlock, opts);
    document.addEventListener('pointerdown', unlock, opts);
    return () => {
      document.removeEventListener('touchstart', unlock, opts);
      document.removeEventListener('pointerdown', unlock, opts);
    };
  }, []);

  // FFT visualizer loop — samples active audio slot or idle motion when paused
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const slot = activeSlotRef.current;
      const an = analyserSlotsRef.current[slot]?.analyser;
      const playing = stateRef.current.isPlaying && !stateRef.current.pausedAt;
      if (an && playing) {
        if (rawAnalyserDataRef.current.length !== an.frequencyBinCount) {
          rawAnalyserDataRef.current = new Uint8Array(an.frequencyBinCount);
        }
        an.getByteFrequencyData(rawAnalyserDataRef.current as Uint8Array<ArrayBuffer>);
        reduceFrequencyBins(rawAnalyserDataRef.current, barsRef.current);
      } else {
        fillIdleBars(barsRef.current, performance.now() / 1000);
      }
      updateBassRef(barsRef.current, bassRef);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const loadTrackImmediate = useCallback(
    (
      track: PlaybackTrack,
      source: PlaybackSource,
      autoPlay: boolean,
      seekSeconds: number | null,
    ) => {
      const url = typeof track.audioUrl === 'string' ? track.audioUrl.trim() : '';
      if (!url) return;

      cancelCrossfade();
      const activeSlot = activeSlotRef.current;
      clearAudioSlot(getInactiveSlot());

      hasRetriedAfterErrorRef.current = false;
      autoPlayPendingRef.current = autoPlay;
      isLoadingTrackRef.current = true;
      pendingSeekRef.current = seekSeconds;

      setState((s) => ({
        ...s,
        source,
        track,
        currentTime: seekSeconds ?? 0,
        duration: track.durationSeconds || 0,
        isLoading: true,
        error: null,
        serverPosition: seekSeconds ?? 0,
        pausedAt: autoPlay ? null : s.pausedAt,
        isLive: autoPlay || s.pausedAt == null,
        isPlaying: autoPlay && s.pausedAt == null,
        isMuted: mutedByUserRef.current,
      }));

      attachSourceToSlot(activeSlot, url, seekSeconds, autoPlay, source);
    },
    [attachSourceToSlot, cancelCrossfade, clearAudioSlot, getInactiveSlot],
  );

  const startRadioCrossfade = useCallback(
    (
      track: PlaybackTrack,
      source: PlaybackSource,
      seekSeconds: number | null,
    ) => {
      const url = typeof track.audioUrl === 'string' ? track.audioUrl.trim() : '';
      const outgoing = getActiveAudio();
      const incomingSlot = getInactiveSlot();
      const pair = audioPairRef.current;
      if (!url || !outgoing || !pair) return;

      cancelCrossfade();
      isCrossfadingRef.current = true;
      crossfadeIncomingSlotRef.current = incomingSlot;
      isLoadingTrackRef.current = true;

      setState((s) => ({
        ...s,
        source,
        track,
        duration: track.durationSeconds || 0,
        isLoading: true,
        error: null,
        serverPosition: seekSeconds ?? s.serverPosition,
        isLive: true,
      }));

      const incoming = pair[incomingSlot];
      let started = false;

      const beginCrossfade = () => {
        if (started) return;
        started = true;
        if (seekSeconds !== null && seekSeconds > 0) {
          incoming.currentTime = seekSeconds;
        }
        void playAudio(incoming).catch(() => {});
        isLoadingTrackRef.current = false;
        setState((s) => ({ ...s, isLoading: false, isPlaying: true }));

        crossfadeCancelRef.current = runAudioCrossfade(outgoing, incoming, {
          targetVolume: volumeRef.current,
          durationMs: RADIO_CROSSFADE_MS,
          onComplete: () => {
            crossfadeCancelRef.current = null;
            isCrossfadingRef.current = false;
            crossfadeIncomingSlotRef.current = null;

            const outgoingSlot = activeSlotRef.current;
            clearAudioSlot(outgoingSlot);
            activeSlotRef.current = incomingSlot;
            applyVolumeToAudio(incoming, volumeRef.current);

            setState((s) => ({
              ...s,
              currentTime: incoming.currentTime || 0,
              duration: incoming.duration || track.durationSeconds || 0,
              isPlaying: !incoming.paused,
            }));
          },
        });
      };

      destroyHlsForSlot(incomingSlot);
      incoming.removeAttribute('src');
      incoming.load();
      applyVolumeToAudio(incoming, 0);

      if (url.includes('.m3u8')) {
        isCrossfadingRef.current = false;
        loadTrackImmediate(track, source, true, seekSeconds);
        return;
      }

      incoming.src = url;
      incoming.addEventListener('canplay', beginCrossfade, { once: true });
    },
    [
      cancelCrossfade,
      clearAudioSlot,
      destroyHlsForSlot,
      getActiveAudio,
      getInactiveSlot,
      loadTrackImmediate,
      playAudio,
    ],
  );

  const loadTrack = useCallback(
    (
      track: PlaybackTrack,
      source: PlaybackSource,
      autoPlay?: boolean,
      seekSeconds?: number | null,
    ) => {
      const pair = audioPairRef.current;
      const outgoing = getActiveAudio();
      if (!pair || !outgoing) return;

      // Switching away from radio (e.g. discography/refinery) clears the radio
      // mute so other sources aren't silenced.
      if (source !== 'radio' && mutedByUserRef.current) {
        mutedByUserRef.current = false;
        setState((s) => ({ ...s, isMuted: false }));
      }
      // Tuning back into live radio (from library preview, etc.) should be audible.
      if (source === 'radio' && sourceRef.current !== 'radio') {
        mutedByUserRef.current = false;
      }

      // Join the radio at its live offset so all listeners stay aligned. Ignore
      // tiny/zero offsets (natural start-of-song or non-radio loads).
      const joinSeek =
        source === 'radio' &&
        typeof seekSeconds === 'number' &&
        Number.isFinite(seekSeconds) &&
        seekSeconds > 1
          ? seekSeconds
          : null;

      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }

      const url = typeof track.audioUrl === 'string' ? track.audioUrl.trim() : '';
      if (!url) {
        isLoadingTrackRef.current = false;
        autoPlayPendingRef.current = false;
        setState((s) => ({
          ...s,
          source,
          track,
          isLoading: false,
          error: 'No audio source available.',
        }));
        return;
      }

      const previousTrackId = trackIdRef.current;
      // A station switch is a user-initiated cut, not a natural in-station
      // track transition — switching stations should change songs immediately
      // rather than overlapping the previous station's song for the full
      // crossfade window.
      const previousRadioId = trackRadioIdRef.current;
      const stationChanged =
        source === 'radio' &&
        sourceRef.current === 'radio' &&
        !!previousRadioId &&
        !!track.radioId &&
        previousRadioId !== track.radioId;
      if (stationChanged) {
        mutedByUserRef.current = false;
      }
      if (source === 'radio' && previousTrackId && previousTrackId !== track.id) {
        recentlyAdvancedFromRef.current = { id: previousTrackId, at: Date.now() };
      }
      const shouldCrossfade =
        source === 'radio' &&
        sourceRef.current === 'radio' &&
        !!previousTrackId &&
        previousTrackId !== track.id &&
        !stationChanged &&
        // While muted there's no audio to blend; hard-cut (loadTrackImmediate
        // keeps it muted+playing) and skip the volume-ramping crossfade.
        !mutedByUserRef.current &&
        isCrossfadeSupportedUrl(url) &&
        !outgoing.paused &&
        !outgoing.ended &&
        outgoing.currentTime > 0 &&
        !isIosSafari() &&
        // rAF-based crossfade can't run in a hidden tab; switch instantly.
        !(typeof document !== 'undefined' && document.hidden) &&
        (autoPlay ?? true);

      if (shouldCrossfade) {
        startRadioCrossfade(track, source, joinSeek);
        return;
      }

      loadTrackImmediate(track, source, !!autoPlay, joinSeek);
    },
    [getActiveAudio, loadTrackImmediate, startRadioCrossfade],
  );

  // Start a 6s overlap crossfade before the current song ends.
  useEffect(() => {
    if (state.source !== 'radio') return;
    if (!state.isPlaying || state.pausedAt) return;
    // Never crossfade-ahead while the tab is hidden. requestAnimationFrame is
    // paused in background tabs, so a crossfade started here would never
    // complete (jamming the player), and peeking ahead without the server
    // rotating its queue causes the just-played song to replay on `ended`.
    // While hidden we let the song play to its end and advance via the
    // `ended` handler (an authoritative server force-advance) instead.
    if (typeof document !== 'undefined' && document.hidden) return;
    const track = state.track;
    if (!track?.id || !track.radioId) return;

    const duration =
      state.duration > 0 ? state.duration : track.durationSeconds || 0;
    if (duration <= 0) return;

    const remainingSec = duration - state.currentTime;
    const crossfadeSec = RADIO_CROSSFADE_MS / 1000;
    if (remainingSec > crossfadeSec + 0.5) {
      if (crossfadePrefetchTrackIdRef.current === track.id) {
        crossfadePrefetchTrackIdRef.current = null;
      }
      return;
    }
    if (crossfadePrefetchTrackIdRef.current === track.id) return;
    if (isCrossfadePrefetchingRef.current || isCrossfadingRef.current) return;

    crossfadePrefetchTrackIdRef.current = track.id;
    const currentTrackId = track.id;
    const radioId = track.radioId;
    let cancelled = false;

    void (async () => {
      isCrossfadePrefetchingRef.current = true;
      try {
        const response = await radioApi.peekNextTrack(radioId);
        if (cancelled) return;
        const trackData = response.data as Record<string, unknown>;
        if (trackData?.no_content || !trackData?.id) return;
        if (String(trackData.id) === currentTrackId) return;

        const audioUrl = trackData.audio_url;
        if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) {
          return;
        }
        if (!isCrossfadeSupportedUrl(audioUrl)) return;

        const nextTrack: PlaybackTrack = {
          id: String(trackData.id),
          title: String(trackData.title ?? 'Untitled'),
          artistName: String(trackData.artist_name ?? 'Unknown artist'),
          artistOriginCity: (trackData.artist_origin_city as string | null) ?? null,
          artistOriginState: (trackData.artist_origin_state as string | null) ?? null,
          artistId: (trackData.artist_id as string | null) ?? null,
          radioId,
          artworkUrl: resolveTrackArtworkUrl(
            (trackData.artwork_url as string | null) ?? null,
          ),
          audioUrl,
          durationSeconds: Number(trackData.duration_seconds) || 180,
          playId: (trackData.play_id as string | null) ?? null,
        };

        loadTrack(nextTrack, 'radio', true);
      } catch {
        if (!cancelled) crossfadePrefetchTrackIdRef.current = null;
      } finally {
        isCrossfadePrefetchingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loadTrack,
    state.currentTime,
    state.duration,
    state.isPlaying,
    state.pausedAt,
    state.source,
    state.track,
  ]);

  const radioStreamShouldRun = useCallback(() => {
    const s = stateRef.current;
    if (sourceRef.current !== 'radio' || !s.track) return false;
    if (s.pausedAt != null) return false;
    if (globalTransportPausedRef.current) return false;
    return true;
  }, []);

  const radioShouldBeAudible = useCallback(
    () => radioStreamShouldRun() && !mutedByUserRef.current,
    [radioStreamShouldRun],
  );

  // Recover playback when returning to a backgrounded tab. Browsers throttle
  // timers and frequently stall media in hidden tabs, which can leave the radio
  // paused/buffering even though the UI shows the correct song — previously this
  // only recovered on a manual refresh. On refocus, if the listener did not
  // intentionally pause/mute, reload or resume the stream when audio stalled.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void unlockWebAudioContext(analyserCtxRef);
      if (!radioStreamShouldRun()) return;

      const s = stateRef.current;
      const audible = radioShouldBeAudible();

      // A crossfade that began just before the tab was hidden can stall because
      // requestAnimationFrame is paused in background tabs. On refocus, finalize
      // it by cancelling and reloading the intended (incoming) track so playback
      // resumes cleanly instead of jamming mid-transition.
      if (isCrossfadingRef.current) {
        cancelCrossfade();
        loadTrackImmediate(s.track!, 'radio', audible, null);
        return;
      }
      if (isLoadingTrackRef.current) return;

      const audio = getActiveAudio();
      if (!audio) return;
      const stalled =
        audio.paused ||
        audio.ended ||
        audio.readyState < 2 /* HAVE_CURRENT_DATA */ ||
        audio.networkState === 3 /* NETWORK_NO_SOURCE */;

      if (!stalled) {
        if (audible && audio.paused) {
          void playAudio(audio).catch(() => undefined);
        }
        return;
      }

      const resumeAt =
        s.serverPosition > 0
          ? s.serverPosition
          : Number.isFinite(audio.currentTime) && audio.currentTime > 0
            ? audio.currentTime
            : null;
      loadTrackImmediate(s.track!, 'radio', audible, resumeAt);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [
    cancelCrossfade,
    getActiveAudio,
    loadTrackImmediate,
    playAudio,
    radioShouldBeAudible,
    radioStreamShouldRun,
  ]);

  // Keep radio playing while the tab/app is backgrounded (other tabs, mobile
  // home screen, lock screen). Browsers may pause <audio> or suspend Web Audio;
  // nudge playback back on a timer and when visibility changes.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const maintainPlayback = () => {
      if (!radioStreamShouldRun()) return;
      void unlockWebAudioContext(analyserCtxRef);

      const ctx = analyserCtxRef.current;
      if (ctx?.state === 'suspended' && radioShouldBeAudible()) {
        void ctx.resume().catch(() => undefined);
      }

      const audio = getActiveAudio();
      if (!audio) return;
      const audible = radioShouldBeAudible();

      if (audio.ended && onRadioTrackEndedRef.current) {
        onRadioTrackEndedRef.current();
        return;
      }

      const stalled =
        audio.paused ||
        audio.readyState < 2 /* HAVE_CURRENT_DATA */ ||
        audio.networkState === 3 /* NETWORK_NO_SOURCE */;

      if (!stalled) return;

      void playAudio(audio).catch(() => undefined);
    };

    maintainPlayback();
    const interval = setInterval(maintainPlayback, 2500);
    document.addEventListener('visibilitychange', maintainPlayback);
    window.addEventListener('pageshow', maintainPlayback);
    window.addEventListener('focus', maintainPlayback);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', maintainPlayback);
      window.removeEventListener('pageshow', maintainPlayback);
      window.removeEventListener('focus', maintainPlayback);
    };
  }, [getActiveAudio, playAudio, radioShouldBeAudible, radioStreamShouldRun]);

  const play = useCallback(async () => {
    const audio = getActiveAudio();
    if (!audio) return;
    notifyUserPlaybackGesture();
    setState((s) => ({ ...s, isPlaying: true, error: null }));
    try {
      await playAudio(audio);
    } catch {
      setState((s) => ({
        ...s,
        isPlaying: false,
        error: 'Failed to play. Tap play to start audio.',
      }));
    }
  }, [getActiveAudio, notifyUserPlaybackGesture, playAudio]);

  const pause = useCallback(() => {
    cancelCrossfade();
    const pair = audioPairRef.current;
    pair?.a.pause();
    pair?.b.pause();
    setState((s) => ({ ...s, isPlaying: false }));
  }, [cancelCrossfade]);

  const setVolume = useCallback(
    (vol: number) => {
      const v = Math.max(0, Math.min(1, vol));
      volumeRef.current = v;
      refreshMainVolume();
      setState((s) => ({ ...s, volume: v }));
    },
    [refreshMainVolume],
  );

  const seek = useCallback(
    (time: number) => {
      const audio = getActiveAudio();
      if (audio) audio.currentTime = time;
    },
    [getActiveAudio],
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const syncToPosition = useCallback(
    (positionSeconds: number) => {
      const audio = getActiveAudio();
      if (!audio || positionSeconds <= 0) return;

      if (isCrossfadingRef.current && crossfadeIncomingSlotRef.current) {
        const incoming = audioPairRef.current?.[crossfadeIncomingSlotRef.current];
        if (incoming) {
          pendingSeekRef.current = positionSeconds;
          if (!incoming.paused && incoming.readyState >= 2) {
            incoming.currentTime = positionSeconds;
            pendingSeekRef.current = null;
          }
        }
        setState((s) => ({ ...s, serverPosition: positionSeconds, isLive: true }));
        return;
      }

      if (audio.paused || isLoadingTrackRef.current) {
        pendingSeekRef.current = positionSeconds;
        setState((s) => ({ ...s, serverPosition: positionSeconds, isLive: true }));
        return;
      }

      const delta = positionSeconds - audio.currentTime;
      const needsForwardCatchup = delta > LIVE_SYNC_FORWARD_SEEK_THRESHOLD_SEC;
      const needsBackwardCorrection = delta < -LIVE_SYNC_BACKWARD_SEEK_THRESHOLD_SEC;

      // Server clock can run ahead of the decoded file. Don't leap forward while
      // substantial audio remains or songs feel like they're skipping.
      const decodedDuration =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : 0;
      const localRemaining =
        decodedDuration > 0 ? decodedDuration - audio.currentTime : 0;
      const blockForwardCatchup =
        needsForwardCatchup && localRemaining > 12;

      if (!needsForwardCatchup && !needsBackwardCorrection) {
        setState((s) => ({ ...s, serverPosition: positionSeconds, isLive: true }));
        return;
      }

      if (blockForwardCatchup) {
        setState((s) => ({ ...s, serverPosition: positionSeconds, isLive: true }));
        return;
      }

      const now = Date.now();
      if (now - lastSyncSeekAtRef.current >= LIVE_SYNC_SEEK_COOLDOWN_MS) {
        audio.currentTime = positionSeconds;
        lastSyncSeekAtRef.current = now;
      }
      setState((s) => ({ ...s, serverPosition: positionSeconds, isLive: true }));
    },
    [getActiveAudio],
  );

  // Radio "pause" = mute while staying live. The stream keeps playing and
  // advancing on the server timeline (so every device stays in sync); we only
  // silence the output. Unmuting rejoins instantly with no catch-up/DVR drift.
  const softPause = useCallback(() => {
    mutedByUserRef.current = true;
    // Stop any in-flight crossfade volume ramp so it can't un-silence us.
    cancelCrossfade();
    const pair = audioPairRef.current;
    if (pair?.a) {
      pair.a.volume = 0;
      pair.a.muted = true;
    }
    if (pair?.b) {
      pair.b.volume = 0;
      pair.b.muted = true;
    }
    const overlay = overlayAudioRef.current;
    if (overlay) {
      overlay.volume = 0;
      overlay.muted = true;
    }
    // Keep the audio progressing so we stay glued to the live position.
    const audio = getActiveAudio();
    if (audio && audio.paused && !globalTransportPausedRef.current) {
      void playAudio(audio).catch(() => {});
    }
    setState((s) => ({ ...s, isMuted: true, isLive: true }));
  }, [cancelCrossfade, getActiveAudio, playAudio]);

  const softResume = useCallback(async () => {
    mutedByUserRef.current = false;
    notifyUserPlaybackGesture();
    await unlockWebAudioContext(analyserCtxRef);
    setState((s) => ({ ...s, isMuted: false, error: null, isLive: true }));
    const audio = getActiveAudio();
    refreshMainVolume();
    if (!audio) return;
    audio.muted = volumeRef.current <= 0.001;
    try {
      if (audio.paused && !globalTransportPausedRef.current) {
        await playAudio(audio);
      }
      setState((s) => ({ ...s, isPlaying: true }));
    } catch {
      setState((s) => ({
        ...s,
        isPlaying: false,
        error: 'Failed to play. Tap play to start audio.',
      }));
    }
  }, [getActiveAudio, notifyUserPlaybackGesture, playAudio, refreshMainVolume]);

  const togglePlay = useCallback(async () => {
    const s = stateRef.current;
    if (s.source === 'radio') {
      await unlockWebAudioContext(analyserCtxRef);
      if (s.isMuted) {
        await softResume();
        return;
      }
      const audio = getActiveAudio();
      const actuallyPlaying = !!(audio && !audio.paused && !audio.ended);
      if (s.isPlaying && actuallyPlaying) {
        softPause();
      } else {
        await softResume();
      }
      return;
    }
    if (s.isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [getActiveAudio, pause, play, softPause, softResume]);

  const jumpToLive = useCallback(
    async (positionSeconds: number) => {
      const audio = getActiveAudio();
      if (!audio) return;
      cancelCrossfade();
      audio.currentTime = positionSeconds;
      setState((s) => ({ ...s, isPlaying: true, error: null }));
      try {
        await playAudio(audio);
        setState((s) => ({
          ...s,
          isPlaying: true,
          pausedAt: null,
          isLive: true,
          serverPosition: positionSeconds,
        }));
      } catch {
        setState((s) => ({ ...s, isPlaying: false }));
      }
    },
    [cancelCrossfade, getActiveAudio, playAudio],
  );

  const needsJumpToLive = useCallback(() => {
    if (!state.pausedAt) return false;
    return (Date.now() - state.pausedAt) / 1000 > 30;
  }, [state.pausedAt]);

  const stop = useCallback(() => {
    cancelCrossfade();
    clearAudioSlot('a');
    clearAudioSlot('b');
    activeSlotRef.current = 'a';
    setState(initialPlaybackState);
  }, [cancelCrossfade, clearAudioSlot]);

  const actions = useMemo(
    (): PlaybackActions => ({
      loadTrack,
      play,
      pause,
      togglePlay,
      setVolume,
      seek,
      clearError,
      syncToPosition,
      softPause,
      softResume,
      jumpToLive,
      needsJumpToLive,
      stop,
      applyServerBoothState,
      handleDjBoothEvent,
    }),
    [
      loadTrack,
      play,
      pause,
      togglePlay,
      setVolume,
      seek,
      clearError,
      syncToPosition,
      softPause,
      softResume,
      jumpToLive,
      needsJumpToLive,
      stop,
      applyServerBoothState,
      handleDjBoothEvent,
    ],
  );

  const value: PlaybackContextValue = {
    state,
    actions,
    setOnRadioTrackEnded,
    radioPlayerUiActive,
    registerRadioPlayerUi,
    isStaleRadioServerTrack,
    barsRef,
    bassRef,
  };

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
}
