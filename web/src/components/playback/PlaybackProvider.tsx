'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Hls from 'hls.js';
import type { PlaybackSource, PlaybackState, PlaybackTrack } from './types';
import { initialPlaybackState } from './types';

type PlaybackActions = {
  /** Load and optionally play a track. Stops any current playback (single session rule). */
  loadTrack: (track: PlaybackTrack, source: PlaybackSource) => void;
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
};

type PlaybackContextValue = {
  state: PlaybackState;
  actions: PlaybackActions;
  /** Register callback when track ends (e.g. radio fetches next). Called only when source === 'radio'. */
  setOnRadioTrackEnded: (cb: (() => void) | null) => void;
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

export function PlaybackProvider({ children }: PlaybackProviderProps) {
  const [state, setState] = useState<PlaybackState>(initialPlaybackState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const onRadioTrackEndedRef = useRef<(() => void) | null>(null);
  const sourceRef = useRef<PlaybackSource>(null);
  /** One recovery attempt for same track before advancing on media error (avoid skip cascade). */
  const hasRetriedAfterErrorRef = useRef(false);

  useEffect(() => {
    sourceRef.current = state.source;
  }, [state.source]);

  const setOnRadioTrackEnded = useCallback((cb: (() => void) | null) => {
    onRadioTrackEndedRef.current = cb;
  }, []);

  // Single audio element and event wiring
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const audio = new Audio();
    const isIosDevice =
      /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' &&
        window.navigator.maxTouchPoints > 1);
    // iOS Safari ignores programmatic volume changes for media playback.
    // Keep volume at 1 and use mute/unmute for zero-volume UX.
    audio.volume = isIosDevice ? 1 : state.volume;
    audio.muted = state.volume <= 0.001;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setState((s) => ({ ...s, currentTime: audio.currentTime || 0 }));
    };
    const onDurationChange = () => {
      setState((s) => ({ ...s, duration: audio.duration || 0 }));
    };
    const onPlay = () => setState((s) => ({ ...s, isPlaying: true }));
    const onPause = () => setState((s) => ({ ...s, isPlaying: false }));
    const onLoadStart = () => setState((s) => ({ ...s, isLoading: true }));
    const onCanPlay = () => setState((s) => ({ ...s, isLoading: false }));
    const onError = () => {
      const mediaError = audio.error;
      const isUnsupported =
        mediaError?.code === 4 || mediaError?.message?.includes('supported source');
      setState((s) => ({
        ...s,
        error: isUnsupported ? 'Audio source not available.' : 'Failed to load audio',
        isLoading: false,
      }));
      if (isUnsupported && sourceRef.current === 'radio') {
        if (!hasRetriedAfterErrorRef.current) {
          hasRetriedAfterErrorRef.current = true;
          audio.load();
          audio.play().catch(() => {
            onRadioTrackEndedRef.current?.();
          });
        } else {
          onRadioTrackEndedRef.current?.();
        }
      }
    };
    const onEnded = () => {
      if (sourceRef.current === 'radio' && onRadioTrackEndedRef.current) {
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
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const loadTrack = useCallback((track: PlaybackTrack, source: PlaybackSource) => {
    const audio = audioRef.current;
    if (!audio) return;

    hasRetriedAfterErrorRef.current = false;

    const url = typeof track.audioUrl === 'string' ? track.audioUrl.trim() : '';
    if (!url) {
      setState((s) => ({
        ...s,
        source,
        track,
        isLoading: false,
        error: 'No audio source available.',
      }));
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    audio.removeAttribute('src');
    audio.load();

    setState((s) => ({
      ...s,
      source,
      track,
      currentTime: 0,
      duration: track.durationSeconds || 0,
      isLoading: true,
      error: null,
      serverPosition: 0,
      pausedAt: null,
      isLive: true,
    }));

    if (url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(audio);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setState((s) => ({ ...s, isLoading: false }));
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setState((s) => ({ ...s, error: 'Stream error', isLoading: false }));
            if (source === 'radio' && onRadioTrackEndedRef.current) {
              onRadioTrackEndedRef.current();
            }
          }
        });
        hlsRef.current = hls;
      } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        audio.src = url;
      } else {
        setState((s) => ({ ...s, error: 'HLS not supported', isLoading: false }));
      }
    } else {
      audio.src = url;
    }
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
    } catch {
      setState((s) => ({ ...s, error: 'Failed to play.' }));
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(async () => {
    if (state.isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [state.isPlaying, pause, play]);

  const setVolume = useCallback((vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    if (audioRef.current) {
      const audio = audioRef.current;
      const isIosDevice =
        typeof window !== 'undefined' &&
        (/iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
          (window.navigator.platform === 'MacIntel' &&
            window.navigator.maxTouchPoints > 1));
      if (isIosDevice) {
        audio.volume = 1;
        audio.muted = v <= 0.001;
      } else {
        audio.volume = v;
        audio.muted = v <= 0.001;
      }
    }
    setState((s) => ({ ...s, volume: v }));
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const syncToPosition = useCallback((positionSeconds: number) => {
    const audio = audioRef.current;
    if (!audio || positionSeconds <= 0) return;
    const drift = Math.abs(audio.currentTime - positionSeconds);
    if (drift > 2) audio.currentTime = positionSeconds;
    setState((s) => ({ ...s, serverPosition: positionSeconds, isLive: true }));
  }, []);

  const softPause = useCallback(() => {
    audioRef.current?.pause();
    setState((s) => ({ ...s, pausedAt: Date.now(), isLive: false }));
  }, []);

  const softResume = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const pausedAt = state.pausedAt;
    const pauseDuration = pausedAt ? (Date.now() - pausedAt) / 1000 : 0;
    if (pauseDuration <= 30) {
      try {
        await audio.play();
        setState((s) => ({ ...s, pausedAt: null }));
      } catch {
        // ignore
      }
    }
  }, [state.pausedAt]);

  const jumpToLive = useCallback(async (positionSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = positionSeconds;
    try {
      await audio.play();
      setState((s) => ({
        ...s,
        pausedAt: null,
        isLive: true,
        serverPosition: positionSeconds,
      }));
    } catch {
      // ignore
    }
  }, []);

  const needsJumpToLive = useCallback(() => {
    if (!state.pausedAt) return false;
    return (Date.now() - state.pausedAt) / 1000 > 30;
  }, [state.pausedAt]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current?.removeAttribute('src');
    audioRef.current?.load();
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setState(initialPlaybackState);
  }, []);

  const value: PlaybackContextValue = {
    state,
    actions: {
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
    },
    setOnRadioTrackEnded,
  };

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
}
