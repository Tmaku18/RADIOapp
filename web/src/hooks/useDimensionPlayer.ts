'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { leaderboardApi, radioApi, songsApi } from '@/lib/api';
import { DEFAULT_STATION_ID } from '@/data/station-map';

const REACTION_STORAGE_KEY = 'radio:reactionByVoteKey';
type StoredReactions = Record<string, 'fire' | 'shit'>;

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
  canVote: boolean;
  selectedReaction: 'fire' | 'shit' | null;
  isVoting: boolean;
  submitReaction: (reaction: 'fire' | 'shit') => void;
};

export function useDimensionPlayer(): DimensionPlayerModel {
  const playback = usePlaybackOptional();
  const state = playback?.state;
  const actions = playback?.actions;

  const track = state?.track ?? null;
  const radioId = track?.radioId?.trim() || DEFAULT_STATION_ID;
  const [temperature, setTemperature] = useState<number | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<'fire' | 'shit' | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const lastVoteKeyRef = useRef<string | null>(null);

  const canVote = state?.source === 'radio' && !!track?.id;

  const getVoteKey = useCallback(() => {
    if (!track) return null;
    return track.playId ?? `track:${track.id}`;
  }, [track]);

  const readStoredReaction = useCallback((voteKey: string | null) => {
    if (!voteKey || typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(REACTION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredReactions;
      const reaction = parsed[voteKey];
      return reaction === 'fire' || reaction === 'shit' ? reaction : null;
    } catch {
      return null;
    }
  }, []);

  const persistReaction = useCallback(
    (voteKey: string | null, reaction: 'fire' | 'shit') => {
      if (!voteKey || typeof window === 'undefined') return;
      try {
        const raw = window.sessionStorage.getItem(REACTION_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as StoredReactions) : {};
        parsed[voteKey] = reaction;
        window.sessionStorage.setItem(REACTION_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignore storage failures.
      }
    },
    [],
  );

  const clearPersistedReaction = useCallback((voteKey: string | null) => {
    if (!voteKey || typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(REACTION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredReactions;
      delete parsed[voteKey];
      window.sessionStorage.setItem(REACTION_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    const voteKey = getVoteKey();
    if (!voteKey) {
      setSelectedReaction(null);
      return;
    }
    if (voteKey !== lastVoteKeyRef.current) {
      lastVoteKeyRef.current = voteKey;
      setSelectedReaction(readStoredReaction(voteKey));
    }
  }, [getVoteKey, readStoredReaction, track?.id, track?.playId]);

  const refreshTemperature = useCallback(async () => {
    if (state?.source && state.source !== 'radio') return;
    try {
      const res = await radioApi.getCurrentTrack(radioId);
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
  }, [radioId, state?.source]);

  const submitReaction = useCallback(
    async (reaction: 'fire' | 'shit') => {
      if (!track?.id || isVoting || state?.source !== 'radio') return;

      setIsVoting(true);
      try {
        const voteRes = await leaderboardApi.addLeaderboardReaction(
          track.id,
          reaction,
          track.playId ?? undefined,
        );
        const serverReaction = voteRes.data?.reaction ?? null;
        const voteKey = getVoteKey();
        lastVoteKeyRef.current = voteKey;
        setSelectedReaction(serverReaction);
        if (serverReaction) {
          persistReaction(voteKey, serverReaction);
        } else {
          clearPersistedReaction(voteKey);
        }
        if (serverReaction === 'fire') {
          await songsApi.like(track.id);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('library-changed'));
          }
        }
        await refreshTemperature();
      } catch (error) {
        console.error('Failed to submit reaction:', error);
      } finally {
        setIsVoting(false);
      }
    },
    [
      track,
      isVoting,
      state?.source,
      getVoteKey,
      persistReaction,
      clearPersistedReaction,
      refreshTemperature,
    ],
  );

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
    const load = async () => {
      if (cancelled) return;
      await refreshTemperature();
    };
    void load();
    const interval = setInterval(() => {
      if (!cancelled) void refreshTemperature();
    }, 7000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [radioId, state?.source, track?.id, refreshTemperature]);

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

  const canSkip =
    (state?.source === 'discography' || state?.source === 'refinery') &&
    duration > 0;

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
      canVote,
      selectedReaction,
      isVoting,
      submitReaction: (reaction: 'fire' | 'shit') => {
        void submitReaction(reaction);
      },
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
      canVote,
      selectedReaction,
      isVoting,
      submitReaction,
    ],
  );
}
