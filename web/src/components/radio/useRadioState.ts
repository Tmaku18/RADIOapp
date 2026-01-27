'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Hls from 'hls.js';

export interface Track {
  id: string;
  title: string;
  artistName: string;
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
  // True Radio sync state
  serverPosition: number;
  pausedAt: number | null;  // Timestamp when paused (for soft pause)
  isLive: boolean;          // Whether synced to live position
}

interface UseRadioStateOptions {
  onTrackEnded?: () => void;
}

export function useRadioState(options?: UseRadioStateOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onTrackEndedRef = useRef(options?.onTrackEnded);

  // Keep onTrackEnded callback ref in sync
  useEffect(() => {
    onTrackEndedRef.current = options?.onTrackEnded;
  }, [options?.onTrackEnded]);
  
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

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = state.volume;

      // Time update listener
      audioRef.current.addEventListener('timeupdate', () => {
        setState(s => ({
          ...s,
          currentTime: audioRef.current?.currentTime || 0,
        }));
      });

      // Duration change listener
      audioRef.current.addEventListener('durationchange', () => {
        setState(s => ({
          ...s,
          duration: audioRef.current?.duration || 0,
        }));
      });

      // Play/pause listeners
      audioRef.current.addEventListener('play', () => {
        setState(s => ({ ...s, isPlaying: true }));
      });

      audioRef.current.addEventListener('pause', () => {
        setState(s => ({ ...s, isPlaying: false }));
      });

      // Error listener
      audioRef.current.addEventListener('error', () => {
        setState(s => ({ 
          ...s, 
          error: 'Failed to load audio',
          isLoading: false,
        }));
      });

      // Loading listeners
      audioRef.current.addEventListener('loadstart', () => {
        setState(s => ({ ...s, isLoading: true }));
      });

      audioRef.current.addEventListener('canplay', () => {
        setState(s => ({ ...s, isLoading: false }));
      });

      // Track ended listener - immediately trigger next track fetch
      audioRef.current.addEventListener('ended', () => {
        if (onTrackEndedRef.current) {
          onTrackEndedRef.current();
        }
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  const loadTrack = useCallback((track: Track) => {
    if (!audioRef.current) return;

    setState(s => ({ 
      ...s, 
      currentTrack: track, 
      isLoading: true,
      error: null,
    }));

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const url = track.audioUrl;

    // Check if HLS stream
    if (url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(url);
        hls.attachMedia(audioRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setState(s => ({ ...s, isLoading: false }));
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setState(s => ({ 
              ...s, 
              error: 'Stream error: ' + data.type,
              isLoading: false,
            }));
          }
        });
        hlsRef.current = hls;
      } else if (audioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        audioRef.current.src = url;
      } else {
        setState(s => ({ 
          ...s, 
          error: 'HLS not supported in this browser',
          isLoading: false,
        }));
      }
    } else {
      // Standard audio file
      audioRef.current.src = url;
    }
  }, []);

  const play = useCallback(async () => {
    if (!audioRef.current) return;
    
    try {
      await audioRef.current.play();
    } catch (error) {
      console.error('Failed to play:', error);
      setState(s => ({ 
        ...s, 
        error: 'Failed to play audio. Please try again.',
      }));
    }
  }, []);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  const setVolume = useCallback((vol: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, vol));
    }
    setState(s => ({ ...s, volume: vol }));
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }));
  }, []);

  /**
   * Sync to server position (True Radio).
   * Called when loading track or periodically to handle drift.
   */
  const syncToPosition = useCallback((positionSeconds: number) => {
    if (audioRef.current && positionSeconds > 0) {
      const currentPos = audioRef.current.currentTime;
      const drift = Math.abs(currentPos - positionSeconds);
      
      // Only seek if drift is more than 2 seconds
      if (drift > 2) {
        audioRef.current.currentTime = positionSeconds;
      }
      
      setState(s => ({ 
        ...s, 
        serverPosition: positionSeconds,
        isLive: true,
      }));
    }
  }, []);

  /**
   * Handle soft pause - track when user pauses for DVR-style buffer.
   */
  const softPause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setState(s => ({ 
      ...s, 
      pausedAt: Date.now(),
      isLive: false,
    }));
  }, []);

  /**
   * Resume from soft pause - if within 30s, resume from buffer.
   */
  const softResume = useCallback(async () => {
    if (!audioRef.current) return;
    
    const pauseDuration = state.pausedAt ? (Date.now() - state.pausedAt) / 1000 : 0;
    
    // If paused less than 30s, just resume (DVR buffer)
    if (pauseDuration <= 30) {
      try {
        await audioRef.current.play();
        setState(s => ({ ...s, pausedAt: null }));
      } catch (error) {
        console.error('Failed to resume:', error);
      }
    }
    // If paused more than 30s, caller should use jumpToLive instead
  }, [state.pausedAt]);

  /**
   * Jump to live - re-sync to current server position.
   */
  const jumpToLive = useCallback(async (positionSeconds: number) => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = positionSeconds;
    try {
      await audioRef.current.play();
      setState(s => ({ 
        ...s, 
        pausedAt: null,
        isLive: true,
        serverPosition: positionSeconds,
      }));
    } catch (error) {
      console.error('Failed to jump to live:', error);
    }
  }, []);

  /**
   * Check if user needs to "Jump to Live" (paused > 30s).
   */
  const needsJumpToLive = useCallback(() => {
    if (!state.pausedAt) return false;
    return (Date.now() - state.pausedAt) / 1000 > 30;
  }, [state.pausedAt]);

  return {
    state,
    loadTrack,
    play,
    pause,
    togglePlay,
    setVolume,
    seek,
    clearError,
    // True Radio functions
    syncToPosition,
    softPause,
    softResume,
    jumpToLive,
    needsJumpToLive,
  };
}
