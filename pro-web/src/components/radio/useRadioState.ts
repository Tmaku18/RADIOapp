'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  syncOverlayHls,
  applyDuckToMain,
  applyOverlayVolume,
  playSoundboardClipOnOverlay,
  type DjBoothEvent,
  type DjOverlayState,
} from '@/lib/dj-booth-listener';
import {
  isCrossfadeSupportedUrl,
  isIosSafari,
  RADIO_CROSSFADE_MS,
  runAudioCrossfade,
} from '@/lib/radio-crossfade';

export interface Track {
  id: string;
  title: string;
  artistName: string;
  artistId?: string | null;
  artworkUrl: string | null;
  audioUrl: string;
  durationSeconds: number;
}

export interface RadioState {
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  currentTrack: Track | null;
  isLoading: boolean;
  error: string | null;
  serverPosition: number;
  pausedAt: number | null;
  isLive: boolean;
}

interface UseRadioStateOptions {
  onTrackEnded?: () => void;
  onTrackError?: (reason: 'unsupported_source' | 'load_error') => void;
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

export function useRadioState(options?: UseRadioStateOptions) {
  const LIVE_SYNC_FORWARD_SEEK_THRESHOLD_SEC = 3;
  const LIVE_SYNC_BACKWARD_SEEK_THRESHOLD_SEC = 6;
  const LIVE_SYNC_SEEK_COOLDOWN_MS = 15000;
  const audioPairRef = useRef<{ a: HTMLAudioElement; b: HTMLAudioElement } | null>(null);
  const activeSlotRef = useRef<AudioSlot>('a');
  const hlsBySlotRef = useRef<{ a: Hls | null; b: Hls | null }>({ a: null, b: null });
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onTrackEndedRef = useRef(options?.onTrackEnded);
  const onTrackErrorRef = useRef(options?.onTrackError);
  const lastSyncSeekAtRef = useRef(0);
  const trackIdRef = useRef<string | null>(null);
  const volumeRef = useRef(1);
  const crossfadeCancelRef = useRef<(() => void) | null>(null);
  const isCrossfadingRef = useRef(false);
  const crossfadeIncomingSlotRef = useRef<AudioSlot | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const overlayAudioRef = useRef<HTMLAudioElement | null>(null);
  const overlayHlsRef = useRef<Hls | null>(null);
  const djOverlayRef = useRef<DjOverlayState | null>(null);

  useEffect(() => {
    onTrackEndedRef.current = options?.onTrackEnded;
  }, [options?.onTrackEnded]);

  useEffect(() => {
    onTrackErrorRef.current = options?.onTrackError;
  }, [options?.onTrackError]);

  const [state, setState] = useState<RadioState>({
    isPlaying: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    currentTrack: null,
    isLoading: false,
    error: null,
    serverPosition: 0,
    pausedAt: null,
    isLive: true,
  });

  useEffect(() => {
    volumeRef.current = state.volume;
  }, [state.volume]);

  useEffect(() => {
    trackIdRef.current = state.currentTrack?.id ?? null;
  }, [state.currentTrack?.id]);

  const getActiveAudio = useCallback(() => {
    const pair = audioPairRef.current;
    if (!pair) return null;
    return pair[activeSlotRef.current];
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

  const attachSourceToSlot = useCallback(
    (slot: AudioSlot, url: string, autoPlay: boolean) => {
      const pair = audioPairRef.current;
      if (!pair) return;
      const audio = pair[slot];

      destroyHlsForSlot(slot);
      audio.removeAttribute('src');
      audio.load();
      applyVolumeToAudio(audio, slot === activeSlotRef.current ? volumeRef.current : 0);

      const onReady = () => {
        if (autoPlay) audio.play().catch(() => {});
      };

      if (url.includes('.m3u8')) {
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(url);
          hls.attachMedia(audio);
          hls.on(Hls.Events.MANIFEST_PARSED, onReady);
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              setState((s) => ({
                ...s,
                error: 'Stream error: ' + data.type,
                isLoading: false,
              }));
            }
          });
          hlsBySlotRef.current[slot] = hls;
        } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
          audio.src = url;
          audio.addEventListener('canplay', onReady, { once: true });
        } else {
          setState((s) => ({ ...s, error: 'HLS not supported in this browser', isLoading: false }));
        }
      } else {
        audio.src = url;
        if (autoPlay) {
          audio.addEventListener('canplay', onReady, { once: true });
        }
      }
    },
    [destroyHlsForSlot],
  );

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
        setState((s) => ({ ...s, isPlaying: true }));
      };
      const onPause = () => {
        if (activeSlotRef.current !== slot || isCrossfadingRef.current) return;
        setState((s) => ({ ...s, isPlaying: false }));
      };
      const onError = () => {
        if (activeSlotRef.current !== slot && crossfadeIncomingSlotRef.current !== slot) return;
        const mediaError = audio.error;
        const isUnsupportedSource =
          mediaError?.code === 4 || mediaError?.message?.includes('supported source');
        const message = isUnsupportedSource
          ? 'Audio source not available. Trying next track…'
          : 'Failed to load audio';
        setState((s) => ({ ...s, error: message, isLoading: false }));
        if (isUnsupportedSource && onTrackErrorRef.current) {
          onTrackErrorRef.current('unsupported_source');
        } else if (onTrackErrorRef.current) {
          onTrackErrorRef.current('load_error');
        }
      };
      const onLoadStart = () => {
        if (activeSlotRef.current !== slot && !isCrossfadingRef.current) return;
        setState((s) => ({ ...s, isLoading: true }));
      };
      const onCanPlay = () => {
        if (activeSlotRef.current !== slot && crossfadeIncomingSlotRef.current !== slot) return;
        const seekTo = pendingSeekRef.current;
        if (seekTo !== null && seekTo > 0 && activeSlotRef.current === slot) {
          pendingSeekRef.current = null;
          audio.currentTime = seekTo;
        }
        setState((s) => ({ ...s, isLoading: false }));
      };
      const onEnded = () => {
        if (isCrossfadingRef.current) return;
        if (activeSlotRef.current === slot && onTrackEndedRef.current) {
          onTrackEndedRef.current();
        }
      };

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('durationchange', onDurationChange);
      audio.addEventListener('play', onPlay);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('error', onError);
      audio.addEventListener('loadstart', onLoadStart);
      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('ended', onEnded);

      return () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('durationchange', onDurationChange);
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('error', onError);
        audio.removeEventListener('loadstart', onLoadStart);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('ended', onEnded);
      };
    };

    const audioA = new Audio();
    const audioB = new Audio();
    audioPairRef.current = { a: audioA, b: audioB };
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
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [cancelCrossfade, destroyHlsForSlot]);

  const loadTrackImmediate = useCallback(
    (track: Track, autoPlay: boolean) => {
      const url = typeof track.audioUrl === 'string' ? track.audioUrl.trim() : '';
      if (!url) {
        setState((s) => ({
          ...s,
          currentTrack: track,
          isLoading: false,
          error: 'No audio source available for this track.',
        }));
        return;
      }

      cancelCrossfade();
      clearAudioSlot(getInactiveSlot());

      setState((s) => ({
        ...s,
        currentTrack: track,
        isLoading: true,
        error: null,
        duration: track.durationSeconds || 0,
      }));

      attachSourceToSlot(activeSlotRef.current, url, autoPlay);
    },
    [attachSourceToSlot, cancelCrossfade, clearAudioSlot, getInactiveSlot],
  );

  const startRadioCrossfade = useCallback(
    (track: Track) => {
      const url = typeof track.audioUrl === 'string' ? track.audioUrl.trim() : '';
      const outgoing = getActiveAudio();
      const incomingSlot = getInactiveSlot();
      const pair = audioPairRef.current;
      if (!url || !outgoing || !pair) return;

      cancelCrossfade();
      isCrossfadingRef.current = true;
      crossfadeIncomingSlotRef.current = incomingSlot;

      setState((s) => ({
        ...s,
        currentTrack: track,
        isLoading: true,
        error: null,
        duration: track.durationSeconds || 0,
      }));

      const incoming = pair[incomingSlot];
      let started = false;

      const beginCrossfade = () => {
        if (started) return;
        started = true;
        incoming.play().catch(() => {});
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
      incoming.src = url;
      incoming.addEventListener('canplay', beginCrossfade, { once: true });
    },
    [cancelCrossfade, clearAudioSlot, destroyHlsForSlot, getActiveAudio, getInactiveSlot],
  );

  const loadTrack = useCallback(
    (track: Track, autoPlay = true) => {
      const outgoing = getActiveAudio();
      if (!outgoing) return;

      const url = typeof track.audioUrl === 'string' ? track.audioUrl.trim() : '';
      if (!url) {
        setState((s) => ({
          ...s,
          currentTrack: track,
          isLoading: false,
          error: 'No audio source available for this track.',
        }));
        return;
      }

      const previousTrackId = trackIdRef.current;
      const shouldCrossfade =
        !!previousTrackId &&
        previousTrackId !== track.id &&
        isCrossfadeSupportedUrl(url) &&
        !outgoing.paused &&
        !outgoing.ended &&
        outgoing.currentTime > 0 &&
        !isIosSafari() &&
        autoPlay;

      if (shouldCrossfade) {
        startRadioCrossfade(track);
        return;
      }

      loadTrackImmediate(track, autoPlay);
    },
    [getActiveAudio, loadTrackImmediate, startRadioCrossfade],
  );

  const play = useCallback(async () => {
    const audio = getActiveAudio();
    if (!audio) return;
    setState((s) => ({ ...s, isPlaying: true, error: null }));
    try {
      await audio.play();
    } catch (error) {
      console.error('Failed to play:', error);
      setState((s) => ({
        ...s,
        isPlaying: false,
        error: 'Failed to play audio. Please try again.',
      }));
    }
  }, [getActiveAudio]);

  const pause = useCallback(() => {
    cancelCrossfade();
    const pair = audioPairRef.current;
    pair?.a.pause();
    pair?.b.pause();
    setState((s) => ({ ...s, isPlaying: false }));
  }, [cancelCrossfade]);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  const setVolume = useCallback((vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    volumeRef.current = v;
    const pair = audioPairRef.current;
    if (pair) {
      applyVolumeToAudio(pair.a, v);
      applyVolumeToAudio(pair.b, v);
    }
    setState((s) => ({ ...s, volume: v }));
  }, []);

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

      if (audio.paused) {
        pendingSeekRef.current = positionSeconds;
        setState((s) => ({ ...s, serverPosition: positionSeconds, isLive: true }));
        return;
      }

      const currentPos = audio.currentTime;
      const delta = positionSeconds - currentPos;
      const needsForwardCatchup = delta > LIVE_SYNC_FORWARD_SEEK_THRESHOLD_SEC;
      const needsBackwardCorrection = delta < -LIVE_SYNC_BACKWARD_SEEK_THRESHOLD_SEC;
      if (needsForwardCatchup || needsBackwardCorrection) {
        const now = Date.now();
        if (now - lastSyncSeekAtRef.current >= LIVE_SYNC_SEEK_COOLDOWN_MS) {
          audio.currentTime = positionSeconds;
          lastSyncSeekAtRef.current = now;
        }
      }

      setState((s) => ({
        ...s,
        serverPosition: positionSeconds,
        isLive: true,
      }));
    },
    [getActiveAudio],
  );

  const softPause = useCallback(() => {
    cancelCrossfade();
    const pair = audioPairRef.current;
    pair?.a.pause();
    pair?.b.pause();
    setState((s) => ({
      ...s,
      isPlaying: false,
      pausedAt: Date.now(),
      isLive: false,
    }));
  }, [cancelCrossfade]);

  const softResume = useCallback(async () => {
    const audio = getActiveAudio();
    if (!audio) return;

    const pauseDuration = state.pausedAt ? (Date.now() - state.pausedAt) / 1000 : 0;

    if (pauseDuration <= 30) {
      try {
        setState((s) => ({ ...s, isPlaying: true, error: null }));
        await audio.play();
        setState((s) => ({ ...s, isPlaying: true, pausedAt: null }));
      } catch (error) {
        console.error('Failed to resume:', error);
        setState((s) => ({ ...s, isPlaying: false }));
      }
    }
  }, [getActiveAudio, state.pausedAt]);

  const jumpToLive = useCallback(
    async (positionSeconds: number) => {
      const audio = getActiveAudio();
      if (!audio) return;

      cancelCrossfade();
      audio.currentTime = positionSeconds;
      setState((s) => ({ ...s, isPlaying: true, error: null }));
      try {
        await audio.play();
        setState((s) => ({
          ...s,
          isPlaying: true,
          pausedAt: null,
          isLive: true,
          serverPosition: positionSeconds,
        }));
      } catch (error) {
        console.error('Failed to jump to live:', error);
        setState((s) => ({ ...s, isPlaying: false }));
      }
    },
    [cancelCrossfade, getActiveAudio],
  );

  const needsJumpToLive = useCallback(() => {
    if (!state.pausedAt) return false;
    return (Date.now() - state.pausedAt) / 1000 > 30;
  }, [state.pausedAt]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const overlay = new Audio();
    overlayAudioRef.current = overlay;
    return () => {
      overlay.pause();
      overlayHlsRef.current?.destroy();
      overlayHlsRef.current = null;
      overlayAudioRef.current = null;
    };
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
    if (main && ctrl) applyDuckToMain(main, volumeRef.current, ctrl);
    if (ctrl) applyOverlayVolume(ctrl, ctrl.micActive);
  }, [getActiveAudio, getOverlayController]);

  const applyServerBoothState = useCallback(
    (opts: { transportPaused?: boolean; djOverlay?: DjOverlayState | null }) => {
      if (typeof opts.transportPaused === 'boolean') {
        const pair = audioPairRef.current;
        if (opts.transportPaused) {
          pair?.a.pause();
          pair?.b.pause();
          setState((s) => ({ ...s, isPlaying: false }));
        } else {
          const main = getActiveAudio();
          if (main?.paused) {
            main.play().catch(() => undefined);
            setState((s) => ({ ...s, isPlaying: true }));
          }
        }
      }
      if (opts.djOverlay !== undefined) {
        djOverlayRef.current = opts.djOverlay;
        const ctrl = getOverlayController();
        if (ctrl) {
          syncOverlayHls(ctrl, opts.djOverlay, true);
        }
        refreshMainVolume();
      }
    },
    [getActiveAudio, getOverlayController, refreshMainVolume],
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

  return {
    state,
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
    applyServerBoothState,
    handleDjBoothEvent,
  };
}
