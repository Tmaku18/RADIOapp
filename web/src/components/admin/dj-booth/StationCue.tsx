'use client';

import { useEffect, useRef } from 'react';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { radioApi } from '@/lib/api';

type CueSnapshot = {
  id: string;
  audioUrl: string;
  positionSeconds: number;
  capturedAt: number;
  playing: boolean;
};

type Props = {
  /** Play the station into the headset while the DJ is live. */
  active: boolean;
  stationId: string;
  /** Headphone sink from setSinkId. Null plays the system default. */
  sinkId: string | null;
  /** Unmute the page player when the cue stops and headphones are still on. */
  resumeWhenDone: boolean;
};

function readSnapshot(data: Record<string, unknown>, capturedAt: number): CueSnapshot | null {
  const audioUrl = typeof data.audio_url === 'string' ? data.audio_url.trim() : '';
  if (!audioUrl) return null;
  const position = Number(data.position_seconds ?? 0);
  const playing = data.is_playing !== false && data.transport_paused !== true;
  return {
    id: String(data.id ?? audioUrl),
    audioUrl,
    positionSeconds: Number.isFinite(position) ? Math.max(0, position) : 0,
    capturedAt,
    playing,
  };
}

/**
 * Plays the live station into the DJ's headphones while the mic is up.
 * The page player is muted for that stretch so the same song doesn't also
 * come out of the speakers.
 */
export function StationCue({ active, stationId, sinkId, resumeWhenDone }: Props) {
  const playback = usePlaybackOptional();
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wePausedRef = useRef(false);
  const wasActiveRef = useRef(false);
  const trackIdRef = useRef<string | null>(null);

  if (!audioRef.current && typeof Audio !== 'undefined') {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
  }

  const audio = audioRef.current;
  if (audio && !active && !audio.paused) {
    audio.pause();
    audio.volume = 0;
  }

  useEffect(() => {
    const playbackNow = playbackRef.current;
    if (active && !wasActiveRef.current) {
      if (playbackNow && !playbackNow.state.isMuted) {
        playbackNow.actions.softPause();
        wePausedRef.current = true;
      }
    }
    if (!active && wasActiveRef.current) {
      if (wePausedRef.current && resumeWhenDone) {
        void playbackNow?.actions.softResume();
      }
      wePausedRef.current = false;
    }
    wasActiveRef.current = active;
  }, [active, resumeWhenDone]);

  useEffect(() => {
    if (!active || !stationId) return;
    const element = audioRef.current;
    if (!element) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await radioApi.getCurrentTrack(stationId);
        if (cancelled) return;
        const data = (res.data ?? {}) as Record<string, unknown>;
        const snapshot = readSnapshot(data, Date.now());
        if (!snapshot || !snapshot.playing) {
          element.pause();
          return;
        }
        const target =
          snapshot.positionSeconds +
          Math.max(0, (Date.now() - snapshot.capturedAt) / 1000);
        const sinkable = element as HTMLAudioElement & {
          setSinkId?: (id: string) => Promise<void>;
        };
        if (sinkId && typeof sinkable.setSinkId === 'function') {
          try {
            await sinkable.setSinkId(sinkId);
          } catch {
            element.pause();
            return;
          }
        }
        if (cancelled) return;
        if (trackIdRef.current !== snapshot.id || element.src !== snapshot.audioUrl) {
          trackIdRef.current = snapshot.id;
          element.src = snapshot.audioUrl;
          element.currentTime = target;
        } else if (Math.abs((element.currentTime || 0) - target) > 3) {
          element.currentTime = target;
        }
        element.volume = 0.85;
        if (element.paused) {
          await element.play().catch(() => undefined);
        }
      } catch {
        /* booth status poll will retry */
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      element.pause();
    };
  }, [active, stationId, sinkId]);

  useEffect(() => {
    const element = audioRef.current;
    return () => {
      element?.pause();
      if (element) element.src = '';
    };
  }, []);

  return null;
}
