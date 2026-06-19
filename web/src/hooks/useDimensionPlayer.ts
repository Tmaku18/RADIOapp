'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { radioApi } from '@/lib/api';
import { DEFAULT_STATION_ID } from '@/data/station-map';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export type DimensionPlayerModel = {
  title: string;
  artist: string;
  artworkUrl: string | null;
  radioId: string | null;
  listenHref: string;
  isPlaying: boolean;
  isLive: boolean;
  showLiveBadge: boolean;
  progress: number;
  elapsedLabel: string;
  totalLabel: string;
  volume: number;
  temperature: number | null;
  canTransport: boolean;
  canSkip: boolean;
  togglePlay: () => void;
  setVolume: (value: number) => void;
  seekPrev: () => void;
  seekNext: () => void;
  seekToProgress: (percent: number) => void;
};

export function useDimensionPlayer(): DimensionPlayerModel {
  const playback = usePlaybackOptional();
  const state = playback?.state;
  const actions = playback?.actions;

  const track = state?.track ?? null;
  const radioId = track?.radioId?.trim() || DEFAULT_STATION_ID;
  const [temperature, setTemperature] = useState<number | null>(null);

  const isPlaying = (state?.isPlaying ?? false) && !state?.pausedAt;
  const showAsPlaying = isPlaying && !state?.isMuted;
  const isLive = state?.source === 'radio' && !!state?.isLive;
  const showLiveBadge =
    state?.source === 'radio' && showAsPlaying && !state?.isLoading;

  const duration =
    state?.duration && state.duration > 0
      ? state.duration
      : track?.durationSeconds ?? 0;
  const currentTime = state?.currentTime ?? 0;
  const progress =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const listenHref = track?.radioId?.trim()
    ? `/listen?station=${encodeURIComponent(track.radioId.trim())}`
    : '/listen';

  useEffect(() => {
    if (state?.source && state.source !== 'radio') return;
    let cancelled = false;
    const refreshTemperature = async () => {
      try {
        const res = await radioApi.getCurrentTrack(radioId);
        if (cancelled) return;
        const data = res.data;
        if (!data || data.no_content) {
          setTemperature(null);
          return;
        }
        const t = Number(data.temperature_percent);
        if (Number.isFinite(t)) {
          setTemperature(Math.max(0, Math.min(100, Math.round(t))));
        }
      } catch {
        // Temperature refresh should not affect playback UX.
      }
    };
    void refreshTemperature();
    const interval = setInterval(() => {
      if (!cancelled) void refreshTemperature();
    }, 7000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [radioId, state?.source, track?.id]);

  const togglePlay = useCallback(() => {
    if (!actions) return;
    void actions.togglePlay();
  }, [actions]);

  const setVolume = useCallback(
    (value: number) => {
      if (!actions) return;
      actions.setVolume(Math.min(1, Math.max(0, value / 100)));
    },
    [actions],
  );

  const canSkip = state?.source !== 'radio' && duration > 0;

  const seekPrev = useCallback(() => {
    if (!actions || !canSkip) return;
    actions.seek(Math.max(0, currentTime - 10));
  }, [actions, canSkip, currentTime]);

  const seekNext = useCallback(() => {
    if (!actions || !canSkip) return;
    actions.seek(Math.min(duration, currentTime + 10));
  }, [actions, canSkip, currentTime, duration]);

  const seekToProgress = useCallback(
    (percent: number) => {
      if (!actions || duration <= 0) return;
      if (state?.source === 'radio') return;
      actions.seek((percent / 100) * duration);
    },
    [actions, duration, state?.source],
  );

  const displayTemperature =
    state?.source && state.source !== 'radio' ? null : temperature;

  return useMemo(
    (): DimensionPlayerModel => ({
      title: track?.title ?? 'Radio',
      artist: track?.artistName ?? 'Tap to open player',
      artworkUrl: track?.artworkUrl ?? null,
      radioId: track?.radioId?.trim() || null,
      listenHref,
      isPlaying: showAsPlaying,
      isLive,
      showLiveBadge,
      progress,
      elapsedLabel: formatTime(currentTime),
      totalLabel: duration > 0 ? formatTime(duration) : '—',
      volume: Math.round((state?.volume ?? 1) * 100),
      temperature: displayTemperature,
      canTransport: !!actions && (!!track || !!state?.source),
      canSkip,
      togglePlay,
      setVolume,
      seekPrev,
      seekNext,
      seekToProgress,
    }),
    [
      track,
      listenHref,
      showAsPlaying,
      isLive,
      showLiveBadge,
      progress,
      currentTime,
      duration,
      state?.volume,
      state?.source,
      displayTemperature,
      actions,
      canSkip,
      togglePlay,
      setVolume,
      seekPrev,
      seekNext,
      seekToProgress,
    ],
  );
}
