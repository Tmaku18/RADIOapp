'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePlayback } from '@/components/playback';
import type { PlaybackTrack } from '@/components/playback';
import { SyncedLyricsPanel } from './SyncedLyricsPanel';
import { prospectorApi, radioApi, leaderboardApi, analyticsApi, songsApi } from '@/lib/api';
import { artistProfilePath } from '@/lib/artist-links';
import { useAuth } from '@/contexts/AuthContext';
import { hasListenerCapability } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArtworkImage } from '@/components/common/ArtworkImage';

type PinnedCatalyst = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
};

function roleToLabel(role: string): string {
  switch (role) {
    case 'cover_art':
      return 'Cover art';
    case 'video':
      return 'Video';
    case 'production':
      return 'Production';
    case 'photo':
      return 'Photo';
    default:
      return 'Credits';
  }
}

function formatArtistOrigin(
  city?: string | null,
  state?: string | null,
): string | null {
  const c = city?.trim() ?? '';
  const s = state?.trim() ?? '';
  if (c && s) return `${c}, ${s}`;
  if (c) return c;
  if (s) return s;
  return null;
}

interface RadioPlayerProps {
  /** Station/radio id (e.g. us-rap). When set, track and heartbeat use this radio. */
  radioId?: string;
}

const DEFAULT_RADIO_ID = 'global';
const REACTION_STORAGE_KEY = 'radio:reactionByVoteKey';

type StoredReactions = Record<string, 'fire' | 'shit'>;

export function RadioPlayer({ radioId }: RadioPlayerProps = {}) {
  const effectiveRadioId = (radioId || DEFAULT_RADIO_ID).trim();
  const { profile } = useAuth();
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<'fire' | 'shit' | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [isHeartSaving, setIsHeartSaving] = useState(false);
  const [likedInLibrary, setLikedInLibrary] = useState(false);
  const [listenerCount, setListenerCountRaw] = useState(0);
  const listenerCountRef = useRef(0);
  const setListenerCount = useCallback((next: number) => {
    const prev = listenerCountRef.current;
    if (prev === 0 || next === 0) {
      listenerCountRef.current = next;
      setListenerCountRaw(next);
      return;
    }
    const smoothed = Math.round(prev * 0.4 + next * 0.6);
    listenerCountRef.current = smoothed;
    setListenerCountRaw(smoothed);
  }, []);
  const [fireVotes, setFireVotes] = useState(0);
  const [shitVotes, setShitVotes] = useState(0);
  const TEMP_BASELINE = 50;
  const [temperaturePercent, setTemperaturePercent] = useState(TEMP_BASELINE);
  const [showJumpToLive, setShowJumpToLive] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [noContent, setNoContent] = useState(false);
  const [noContentMessage, setNoContentMessage] = useState<string | null>(null);
  const [staleTrackInfo, setStaleTrackInfo] = useState<{
    cachedAt?: string | null;
    reason?: string | null;
  } | null>(null);
  const [isLiveBroadcast, setIsLiveBroadcast] = useState(false);
  const [artistLiveNow, setArtistLiveNow] = useState<{
    sessionId: string;
    status: 'starting' | 'live';
    currentViewers?: number;
  } | null>(null);
  const [pinnedCatalysts, setPinnedCatalysts] = useState<PinnedCatalyst[]>([]);
  const lastVoteKeyRef = useRef<string | null>(null);
  const lastServerPosition = useRef(0);
  const isFetchingNextTrack = useRef(false);
  const isFetchingCurrentTrackRef = useRef(false);
  const consecutiveFetchFailuresRef = useRef(0);
  const nextFetchAllowedAtRef = useRef(0);

  // Prospector-only flows (yield/check-ins/refinery) stay listener-only.
  const isProspector = profile?.role === 'listener';
  // Presence heartbeat should include all authenticated listener-capable roles.
  const canSendPresenceHeartbeat = hasListenerCapability(profile?.role);
  const streamTokenRef = useRef<string>(Math.random().toString(36).slice(2));
  const lastHeartbeatSessionIdRef = useRef<string | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);

  // New station = new listener session; avoids stale heartbeats and forces stream reload when song id matches.
  useEffect(() => {
    streamTokenRef.current = Math.random().toString(36).slice(2);
    lastHeartbeatSessionIdRef.current = null;
  }, [effectiveRadioId]);

  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const [refineryOpen, setRefineryOpen] = useState(false);
  const [refinerySongId, setRefinerySongId] = useState<string | null>(null);
  const [pendingRefinerySongId, setPendingRefinerySongId] = useState<string | null>(null);
  const [showRefineryPrompt, setShowRefineryPrompt] = useState(false);
  const [refineScore, setRefineScore] = useState<number>(8);
  const [whereListen, setWhereListen] = useState('');
  const [remindsOf, setRemindsOf] = useState('');
  const [comments, setComments] = useState('');
  const [isSubmittingRefinery, setIsSubmittingRefinery] = useState(false);
  const [isIosVolumeLocked, setIsIosVolumeLocked] = useState(false);
  
  const { state, actions, setOnRadioTrackEnded } = usePlayback();
  const loadTrackRef = useRef<((t: PlaybackTrack, autoPlay?: boolean) => void) | null>(null);
  const syncToPositionRef = useRef<((pos: number) => void) | null>(null);
  const playRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isIosDevice =
      /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' &&
        window.navigator.maxTouchPoints > 1);
    setIsIosVolumeLocked(isIosDevice);
  }, []);

  useEffect(() => {
    loadTrackRef.current = (t: PlaybackTrack, autoPlay?: boolean) => actions.loadTrack(t, 'radio', autoPlay);
    syncToPositionRef.current = actions.syncToPosition;
    playRef.current = actions.play;
  }, [actions]);

  const handleVolumeInput = useCallback(
    (value: string) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return;
      actions.setVolume(parsed);
    },
    [actions],
  );

  const coerceListenerCount = useCallback((value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
    }
    return 0;
  }, []);

  const updateTemperatureFromCounts = useCallback((nextFireVotes: number, nextShitVotes: number) => {
    const fire = Math.max(0, nextFireVotes);
    const shit = Math.max(0, nextShitVotes);
    setFireVotes(fire);
    setShitVotes(shit);
    setTemperaturePercent(Math.max(0, Math.min(100, TEMP_BASELINE + fire - shit)));
  }, []);

  // Callback for when track ends - immediately fetch next track
  const handleTrackEnded = useCallback(async () => {
    // Prevent multiple concurrent fetches
    if (isFetchingNextTrack.current) return;
    isFetchingNextTrack.current = true;
    
    try {
      // Force-advance so a broken source can't keep re-serving the same track.
      const response = await radioApi.getNextTrack({
        radio: effectiveRadioId,
        force: true,
      });
      const trackData = response.data;
      setListenerCount(coerceListenerCount(trackData?.listener_count));
      const nextFireVotes = coerceListenerCount(trackData?.fire_votes);
      const nextShitVotes = coerceListenerCount(trackData?.shit_votes);
      const nextTemperatureRaw = Number(trackData?.temperature_percent);
      updateTemperatureFromCounts(nextFireVotes, nextShitVotes);
      if (Number.isFinite(nextTemperatureRaw)) {
        setTemperaturePercent(Math.max(0, Math.min(100, Math.round(nextTemperatureRaw))));
      }
      
      // Check for no_content flag
      if (trackData?.no_content) {
        setNoContent(true);
        setNoContentMessage(trackData.message || "No songs are currently available.");
        setStaleTrackInfo(null);
        setArtistLiveNow(null);
        setPinnedCatalysts([]);
        setListenerCount(0);
        return;
      }
      
      // Reset no_content state if we have content
      setNoContent(false);
      setNoContentMessage(null);
      setStaleTrackInfo(
        trackData?.stale
          ? {
              cachedAt:
                typeof trackData?.stale_cached_at === 'string'
                  ? trackData.stale_cached_at
                  : null,
              reason:
                typeof trackData?.stale_reason === 'string'
                  ? trackData.stale_reason
                  : null,
            }
          : null,
      );
      setIsLiveBroadcast(!!trackData?.is_live);
      setArtistLiveNow(trackData?.artist_live_now ?? null);
      setPinnedCatalysts(Array.isArray(trackData?.pinned_catalysts) ? trackData.pinned_catalysts : []);
      
      if (trackData && trackData.id) {
        const audioUrl = trackData.audio_url;
        if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) {
          console.warn('Track has no audio URL; will retry on next poll');
          return;
        }
        const track: PlaybackTrack = {
          id: trackData.id,
          title: trackData.title,
          artistName: trackData.artist_name,
          artistOriginCity: trackData.artist_origin_city ?? null,
          artistOriginState: trackData.artist_origin_state ?? null,
          artistId: trackData.artist_id ?? null,
          radioId: effectiveRadioId,
          artworkUrl: trackData.artwork_url,
          audioUrl,
          durationSeconds: trackData.duration_seconds || 180,
          playId: trackData.play_id ?? null,
        };

        const serverPosition = trackData.position_seconds || 0;
        lastServerPosition.current = serverPosition;

        if (loadTrackRef.current) loadTrackRef.current(track, true);
        if (syncToPositionRef.current) syncToPositionRef.current(serverPosition);
      }
    } catch (error) {
      console.error('Failed to fetch next track:', error);
      setListenerCount(0);
    } finally {
      isFetchingNextTrack.current = false;
    }
  }, [effectiveRadioId, coerceListenerCount, updateTemperatureFromCounts]);

  useEffect(() => {
    setOnRadioTrackEnded(handleTrackEnded);
    return () => setOnRadioTrackEnded(null);
  }, [setOnRadioTrackEnded, handleTrackEnded]);

  const handleCheckIn = async () => {
    if (!isProspector || isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      await prospectorApi.checkIn({ sessionId: lastHeartbeatSessionIdRef.current });
      setShowCheckInPrompt(false);
    } catch (e) {
      console.error('Check-in failed', e);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const submitRefinery = async () => {
    if (!isProspector || !refinerySongId || isSubmittingRefinery) return;
    setIsSubmittingRefinery(true);
    try {
      await prospectorApi.submitRefinement({ songId: refinerySongId, score: refineScore });
      await prospectorApi.submitSurvey({
        songId: refinerySongId,
        responses: {
          whereListen,
          remindsOf,
          comments,
        },
      });
      setRefineryOpen(false);
      setRefinerySongId(null);
      setPendingRefinerySongId(null);
      setShowRefineryPrompt(false);
    } catch (e) {
      console.error('Failed to submit refinery data', e);
    } finally {
      setIsSubmittingRefinery(false);
    }
  };

  // Open refinery prompt when a new song starts (rate + survey the previous song).
  useEffect(() => {
    const currentId = state.track?.id ?? null;
    if (!isProspector) {
      lastTrackIdRef.current = currentId;
      setShowRefineryPrompt(false);
      setPendingRefinerySongId(null);
      return;
    }

    const previousId = lastTrackIdRef.current;
    if (previousId && currentId && previousId !== currentId) {
      setPendingRefinerySongId(previousId);
      setRefineScore(8);
      setWhereListen('');
      setRemindsOf('');
      setComments('');
      setRefineryOpen(false);
      setShowRefineryPrompt(true);
    }
    lastTrackIdRef.current = currentId;
  }, [isProspector, state.track?.id]);

  const handleRefineryPromptYes = useCallback(() => {
    if (!pendingRefinerySongId) return;
    setRefinerySongId(pendingRefinerySongId);
    setShowRefineryPrompt(false);
    setRefineryOpen(true);
  }, [pendingRefinerySongId]);

  const handleRefineryPromptNo = useCallback(() => {
    setShowRefineryPrompt(false);
    setPendingRefinerySongId(null);
  }, []);

  // Heartbeat presence: every 30s while playing so live listener count stays accurate.
  // Yield accrual/check-ins are gated server-side and remain listener-only.
  useEffect(() => {
    if (!canSendPresenceHeartbeat) return;
    if (state.source !== 'radio') return;
    if (!state.track?.id) return;
    if (!state.isPlaying) return;

    let cancelled = false;
    const heartbeatIntervalMs = 30000;
    const send = async () => {
      try {
        await radioApi.sendPresence(
          {
            streamToken: streamTokenRef.current,
            songId: state.track!.id,
            timestamp: new Date().toISOString(),
          },
          effectiveRadioId,
        );
        const res = await radioApi.sendHeartbeat(
          {
            streamToken: streamTokenRef.current,
            songId: state.track!.id,
            timestamp: new Date().toISOString(),
          },
          effectiveRadioId,
        );
        if (cancelled) return;
        const sessionId = res?.data?.sessionId;
        lastHeartbeatSessionIdRef.current = typeof sessionId === 'string' ? sessionId : null;

        const needs = !!res?.data?.requiresCheckIn;
        if (needs) setShowCheckInPrompt(true);
      } catch {
        // Heartbeat failures should not break playback UX.
      }
    };

    send();
    const interval = setInterval(send, heartbeatIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [canSendPresenceHeartbeat, state.track?.id, state.isPlaying, effectiveRadioId]);

  // Fetch current track on mount and periodically
  const fetchCurrentTrack = useCallback(async (shouldSync = false, autoPlay = false) => {
    if (state.source && state.source !== 'radio') return;
    const nowMs = Date.now();
    if (nowMs < nextFetchAllowedAtRef.current) return;
    if (isFetchingCurrentTrackRef.current) return;
    isFetchingCurrentTrackRef.current = true;

    try {
      const response = await radioApi.getCurrentTrack(effectiveRadioId);
      const trackData = response.data;
      setListenerCount(coerceListenerCount(trackData?.listener_count));
      const nextFireVotes = coerceListenerCount(trackData?.fire_votes);
      const nextShitVotes = coerceListenerCount(trackData?.shit_votes);
      const nextTemperatureRaw = Number(trackData?.temperature_percent);
      updateTemperatureFromCounts(nextFireVotes, nextShitVotes);
      if (Number.isFinite(nextTemperatureRaw)) {
        setTemperaturePercent(Math.max(0, Math.min(100, Math.round(nextTemperatureRaw))));
      }
      
      // Check for no_content flag (or backend returned it on error)
      if (trackData?.no_content) {
        setNoContent(true);
        setNoContentMessage(trackData.message || "No songs are currently available.");
        setStaleTrackInfo(null);
        setArtistLiveNow(null);
        setPinnedCatalysts([]);
        setListenerCount(0);
        return;
      }
      
      // Reset no_content state if we have content
      setNoContent(false);
      setNoContentMessage(null);
      setStaleTrackInfo(
        trackData?.stale
          ? {
              cachedAt:
                typeof trackData?.stale_cached_at === 'string'
                  ? trackData.stale_cached_at
                  : null,
              reason:
                typeof trackData?.stale_reason === 'string'
                  ? trackData.stale_reason
                  : null,
            }
          : null,
      );
      setIsLiveBroadcast(!!trackData?.is_live);
      setArtistLiveNow(trackData?.artist_live_now ?? null);
      setPinnedCatalysts(Array.isArray(trackData?.pinned_catalysts) ? trackData.pinned_catalysts : []);
      
      if (trackData && trackData.id) {
        const audioUrl = trackData.audio_url;
        if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) {
          console.warn('Next track has no audio URL; will retry on next poll');
          return;
        }
        const track: PlaybackTrack = {
          id: trackData.id,
          title: trackData.title,
          artistName: trackData.artist_name,
          artistOriginCity: trackData.artist_origin_city ?? null,
          artistOriginState: trackData.artist_origin_state ?? null,
          artistId: trackData.artist_id ?? null,
          radioId: effectiveRadioId,
          artworkUrl: trackData.artwork_url,
          audioUrl,
          durationSeconds: trackData.duration_seconds || 180,
          playId: trackData.play_id ?? null,
        };
        
        // Save server position for sync
        const serverPosition = trackData.position_seconds || 0;
        lastServerPosition.current = serverPosition;

        const normalizeAudioSource = (url: string) => url.split('?')[0];
        const sameTrackDifferentSourcePath =
          !!state.track &&
          state.track.id === track.id &&
          normalizeAudioSource(state.track.audioUrl) !==
            normalizeAudioSource(track.audioUrl);

        const stationChanged =
          state.source === 'radio' &&
          !!state.track &&
          String(state.track.radioId ?? '') !== String(track.radioId ?? '');

        // Reload same song when station changes (stream URL/play id differ), on error, or URL refresh.
        const shouldReloadCurrentTrack =
          !!state.track &&
          state.track.id === track.id &&
          (!!state.error || sameTrackDifferentSourcePath || stationChanged);

        const trackIdentityChanged = !state.track || state.track.id !== track.id;

        const isStaleResponse = !!trackData?.stale;

        if (trackIdentityChanged || shouldReloadCurrentTrack) {
          const resumeAfterStationOrTrackSwitch =
            hasUserInteracted &&
            state.source === 'radio' &&
            state.isPlaying &&
            (stationChanged || trackIdentityChanged);
          const shouldAutoPlay =
            (autoPlay && hasUserInteracted) ||
            (shouldReloadCurrentTrack && hasUserInteracted) ||
            resumeAfterStationOrTrackSwitch;
          actions.loadTrack(track, 'radio', shouldAutoPlay);
          actions.syncToPosition(serverPosition);
        } else if (shouldSync && state.isLive && !isStaleResponse) {
          actions.syncToPosition(serverPosition);
        }
      }
      consecutiveFetchFailuresRef.current = 0;
      nextFetchAllowedAtRef.current = 0;
    } catch (error: unknown) {
      consecutiveFetchFailuresRef.current += 1;
      const backoffMs = Math.min(
        30000,
        1000 * Math.pow(2, Math.max(0, consecutiveFetchFailuresRef.current - 1)),
      );
      nextFetchAllowedAtRef.current = Date.now() + backoffMs;

      const msg = (error as { response?: { data?: { message?: string }; status?: number } })?.response?.data?.message;
      if (msg) setNoContentMessage(msg);
      else setNoContentMessage("No songs are currently available. Please try again later.");
      setNoContent(true);
      setStaleTrackInfo(null);
      setArtistLiveNow(null);
      setPinnedCatalysts([]);
      setListenerCount(0);
      console.warn('Radio current track unavailable:', (error as Error)?.message || error);
    } finally {
      isFetchingCurrentTrackRef.current = false;
    }
  }, [
    actions,
    state.source,
    state.track,
    state.isLive,
    state.error,
    state.isPlaying,
    hasUserInteracted,
    effectiveRadioId,
    coerceListenerCount,
    updateTemperatureFromCounts,
  ]);

  const getVoteKey = useCallback(
    (track: PlaybackTrack | null) =>
      track ? track.playId ?? `track:${track.id}` : null,
    [],
  );

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
        // Ignore storage failures so voting UX is unaffected.
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
      // Ignore storage failures so voting UX is unaffected.
    }
  }, []);

  // Reset vote state when the current vote key changes.
  useEffect(() => {
    const voteKey = getVoteKey(state.track ?? null);
    if (!voteKey) {
      setHasVoted(false);
      setSelectedReaction(null);
      return;
    }
    if (voteKey !== lastVoteKeyRef.current) {
      const storedReaction = readStoredReaction(voteKey);
      if (storedReaction) {
        setHasVoted(true);
        setSelectedReaction(storedReaction);
        lastVoteKeyRef.current = voteKey;
      } else {
        setHasVoted(false);
        setSelectedReaction(null);
      }
    }
  }, [state.track, getVoteKey, readStoredReaction]);

  // Initial fetch and periodic polling
  useEffect(() => {
    fetchCurrentTrack(true, false);
    
    const pollMs = noContent ? 8000 : 30000;
    const interval = setInterval(() => fetchCurrentTrack(true, hasUserInteracted), pollMs);
    
    return () => clearInterval(interval);
  }, [fetchCurrentTrack, hasUserInteracted, noContent]);

  // Check for "Jump to Live" state when paused
  useEffect(() => {
    if (!state.pausedAt) {
      setShowJumpToLive(false);
      return;
    }
    
    // Check every second if we've exceeded 30s pause
    const checkInterval = setInterval(() => {
      if (actions.needsJumpToLive()) {
        setShowJumpToLive(true);
      }
    }, 1000);
    
    return () => clearInterval(checkInterval);
  }, [state.pausedAt, actions]);

  // Handle soft pause toggle
  const handlePauseToggle = async () => {
    // Mark that user has interacted - enables auto-play for subsequent tracks
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }
    
    if (state.isPlaying) {
      actions.softPause();
    } else if (showJumpToLive) {
      await fetchCurrentTrack(false, true);
      await actions.jumpToLive(lastServerPosition.current);
      setShowJumpToLive(false);
    } else {
      await actions.softResume();
    }
  };

  // Handle jump to live
  const handleJumpToLive = async () => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }
    await fetchCurrentTrack(false, true);
    await actions.jumpToLive(lastServerPosition.current);
    setShowJumpToLive(false);
  };

  const handleReaction = async (reaction: 'fire' | 'shit') => {
    if (!state.track) return;
    if (isVoting) return;

    setIsVoting(true);
    setReactionError(null);
    try {
      const voteRes = await leaderboardApi.addLeaderboardReaction(
        state.track.id,
        reaction,
        state.track.playId ?? undefined,
      );
      const serverReaction = voteRes.data?.reaction ?? null;
      const previousReaction = voteRes.data?.previousReaction ?? selectedReaction;

      if (serverReaction === 'fire') {
        // Persist to song library using the existing like endpoint.
        await songsApi.like(state.track.id);
      }
      lastVoteKeyRef.current = getVoteKey(state.track);
      setHasVoted(serverReaction !== null);
      setSelectedReaction(serverReaction);
      if (serverReaction) {
        persistReaction(lastVoteKeyRef.current, serverReaction);
      } else {
        clearPersistedReaction(lastVoteKeyRef.current);
      }
      // Optimistic local update first, then reconcile from server.
      let nextFireVotes = fireVotes;
      let nextShitVotes = shitVotes;
      if (previousReaction === 'fire') nextFireVotes -= 1;
      if (previousReaction === 'shit') nextShitVotes -= 1;
      if (serverReaction === 'fire') nextFireVotes += 1;
      if (serverReaction === 'shit') nextShitVotes += 1;
      updateTemperatureFromCounts(
        Math.max(0, nextFireVotes),
        Math.max(0, nextShitVotes),
      );

      const latest = await radioApi.getCurrentTrack(effectiveRadioId);
      const latestTrack = latest.data;
      const latestFireVotes = coerceListenerCount(latestTrack?.fire_votes);
      const latestShitVotes = coerceListenerCount(latestTrack?.shit_votes);
      updateTemperatureFromCounts(latestFireVotes, latestShitVotes);
      const nextTemperatureRaw = Number(latestTrack?.temperature_percent);
      if (Number.isFinite(nextTemperatureRaw)) {
        setTemperaturePercent(
          Math.max(0, Math.min(100, Math.round(nextTemperatureRaw))),
        );
      }
    } catch (error) {
      console.error('Failed to submit reaction:', error);
      const maybeMessage = (
        error as { response?: { data?: { message?: string } }; message?: string }
      )?.response?.data?.message;
      setReactionError(
        (typeof maybeMessage === 'string' && maybeMessage.trim()) ||
          'Could not submit reaction right now.',
      );
    } finally {
      setIsVoting(false);
    }
  };

  useEffect(() => {
    const trackId = state.track?.id;
    if (!trackId) {
      setLikedInLibrary(false);
      return;
    }
    let cancelled = false;
    const loadLikeStatus = async () => {
      try {
        const res = await songsApi.getLikeStatus(trackId);
        if (!cancelled) {
          setLikedInLibrary(!!res.data?.liked);
        }
      } catch {
        if (!cancelled) {
          setLikedInLibrary(false);
        }
      }
    };
    void loadLikeStatus();
    return () => {
      cancelled = true;
    };
  }, [state.track?.id]);

  const handleToggleLibraryLike = async () => {
    const trackId = state.track?.id;
    if (!trackId || isHeartSaving) return;
    const nextLiked = !likedInLibrary;
    setIsHeartSaving(true);
    setLikedInLibrary(nextLiked);
    try {
      if (nextLiked) {
        await songsApi.like(trackId);
      } else {
        await songsApi.unlike(trackId);
      }
    } catch (error) {
      setLikedInLibrary(!nextLiked);
      console.error('Failed to toggle library like:', error);
    } finally {
      setIsHeartSaving(false);
    }
  };

  const handleBackToLiveRadio = useCallback(async () => {
    await fetchCurrentTrack(false, true);
  }, [fetchCurrentTrack]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (noContent) {
    return (
      <Card className="overflow-hidden">
        <div className="h-[clamp(170px,30vh,320px)] sm:h-[clamp(210px,34vh,360px)] bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 p-8">
            <div className="relative">
              <span className="text-6xl">📻</span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
              </span>
            </div>
            <div className="text-center mt-2">
              <h3 className="text-white text-lg font-semibold">Looking for tracks...</h3>
              <p className="text-gray-400 text-sm mt-1">
                {noContentMessage || 'No songs are queued right now.'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="text-center mb-4">
            <h2 className="text-lg font-semibold text-foreground">No Track Playing</h2>
            <p className="text-muted-foreground text-sm">Auto-retrying&hellip;</p>
          </div>
          <div className="flex items-center justify-center">
            <Button variant="outline" size="sm" onClick={() => fetchCurrentTrack(true, hasUserInteracted)}>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry Now
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden glass-panel border-border/80">
      {/* Album Art — subtle signature gradient behind */}
      <div className="h-[clamp(170px,30vh,320px)] sm:h-[clamp(210px,34vh,360px)] bg-signature relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10" aria-hidden />
        <ArtworkImage
          src={state.track?.artworkUrl}
          alt={state.track?.title || 'Album art'}
          className="w-full h-full object-cover relative z-0"
        />
        
        {/* Loading overlay */}
        {state.isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="p-4 sm:p-5">
        {state.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {staleTrackInfo && (
          <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
            <AlertDescription>
              Showing cached track data while reconnecting.
              {staleTrackInfo.reason ? ` (${staleTrackInfo.reason})` : ''}
            </AlertDescription>
          </Alert>
        )}

        {isProspector && showCheckInPrompt && (
          <Alert className="mb-4">
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span>
                Tap the Ripple check-in to keep earning <span className="font-semibold">rewards</span>.
              </span>
              <Button onClick={handleCheckIn} disabled={isCheckingIn} className="rounded-full">
                {isCheckingIn ? 'Checking in…' : 'Check in'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-center mb-4">
          {isLiveBroadcast && (
            <span className="badge-live inline-flex items-center gap-1.5 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
              </span>
              Now Live
            </span>
          )}
          <div className="mb-2 text-xs text-muted-foreground">
            Live listeners: {listenerCount}
          </div>
          <h2 className="text-xl font-bold text-foreground truncate">
            {state.track?.title || 'No track playing'}
          </h2>
          {state.track?.artistId ? (
            <Link
              href={artistProfilePath(state.track.artistId)}
              onClick={() => {
                if (state.track?.id) {
                  analyticsApi.recordProfileClick(state.track.id).catch(() => {});
                }
              }}
              className="inline-block text-muted-foreground truncate text-left hover:text-foreground hover:underline transition-colors"
            >
              {state.track?.artistName || 'Unknown artist'}
            </Link>
          ) : (
            <span className="text-muted-foreground truncate text-left">
              {state.track?.artistName || 'Unknown artist'}
            </span>
          )}
          {formatArtistOrigin(
            state.track?.artistOriginCity ?? null,
            state.track?.artistOriginState ?? null,
          ) && (
            <p className="text-xs text-muted-foreground/90 truncate">
              From{' '}
              {formatArtistOrigin(
                state.track?.artistOriginCity ?? null,
                state.track?.artistOriginState ?? null,
              )}
            </p>
          )}
          {artistLiveNow && state.track?.artistId && (
            <div className="mt-2">
              <Link href={`/watch/${state.track.artistId}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  {artistLiveNow.status === 'starting' ? 'Stream starting…' : 'Join artist live'}
                </Button>
              </Link>
            </div>
          )}

          {pinnedCatalysts.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground flex flex-col gap-1">
              {pinnedCatalysts.slice(0, 3).map((c) => (
                <div key={`${c.userId}:${c.role}`} className="flex items-center justify-center gap-1.5">
                  <span className="uppercase tracking-wide text-[10px]">{roleToLabel(c.role)} by</span>
                  <Link
                    href={`/artist/${c.userId}`}
                    className="text-foreground/90 hover:text-foreground hover:underline"
                  >
                    {c.displayName}
                  </Link>
                </div>
              ))}
              {pinnedCatalysts.length > 3 && (
                <div className="text-[10px] opacity-80">+ {pinnedCatalysts.length - 3} more</div>
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${state.duration ? (state.currentTime / state.duration) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>{formatTime(state.currentTime)}</span>
            <span>{formatTime(state.duration)}</span>
          </div>
        </div>

        {/* Synced Lyrics */}
        <SyncedLyricsPanel
          songId={state.track?.id}
          currentTimeMs={Math.round(state.currentTime * 1000)}
          className="mb-4"
        />

        {/* LIVE Indicator */}
        <div className="flex items-center justify-center mb-4">
          {state.source === 'discography' ? (
            <Button
              onClick={() => void handleBackToLiveRadio()}
              variant="outline"
              className="rounded-full"
            >
              Return to Live Radio
            </Button>
          ) : state.isLive && state.isPlaying ? (
            <span className="badge-live inline-flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-current" />
              </span>
              LIVE
            </span>
          ) : showJumpToLive ? (
            <Button onClick={handleJumpToLive} className="rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 18l8.5-6L4 6v12zM13 6v12l8.5-6L13 6z" />
              </svg>
              <span className="font-semibold text-sm">Jump to Live</span>
            </Button>
          ) : state.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-full">
              <span className="font-semibold text-sm">Loading…</span>
            </div>
          ) : hasUserInteracted && !state.isPlaying ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-full">
              <span className="font-semibold text-sm">PAUSED</span>
            </div>
          ) : null}
        </div>

        {/* Song temperature meter */}
        <div className="mb-4 rounded-lg border border-border/70 bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Song Temperature</span>
            <span>{temperaturePercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800/70">
            <div
              className="h-full transition-all duration-300 bg-gradient-to-r from-red-600 to-orange-400"
              style={{ width: `${temperaturePercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span>💩 {shitVotes}</span>
            <span>🔥 {fireVotes}</span>
          </div>
          {reactionError && (
            <p className="mt-2 text-xs text-red-300">{reactionError}</p>
          )}
        </div>

        {/* Library actions */}
        <div className="mb-3 flex justify-center gap-2">
          <button
            onClick={() => void handleToggleLibraryLike()}
            disabled={!state.track || isHeartSaving}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-50 ${
              likedInLibrary
                ? 'border-pink-500/50 bg-pink-500/10 text-pink-300'
                : 'border-border/70 bg-muted/30 text-muted-foreground hover:text-foreground'
            }`}
            title={likedInLibrary ? 'Remove from your library' : 'Save to your library'}
          >
            <span className="text-base leading-none">{likedInLibrary ? '♥' : '♡'}</span>
            <span>{isHeartSaving ? 'Saving…' : likedInLibrary ? 'Saved' : 'Save'}</span>
          </button>
          <Button
            asChild
            type="button"
            variant="outline"
            className="rounded-full"
          >
            <Link href="/browse/saved">Your Library</Link>
          </Button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-6">
          <button
            onClick={() => void handleReaction('shit')}
            disabled={!state.track || isVoting || state.source !== 'radio'}
            className={`h-12 w-12 rounded-full text-2xl transition ${
              selectedReaction === 'shit'
                ? 'bg-emerald-600/20 ring-2 ring-emerald-400'
                : 'bg-muted/40 hover:bg-emerald-600/10'
            } disabled:opacity-50`}
            title="Shit reaction"
          >
            💩
          </button>

          {/* Pause/Resume Button (Soft Pause) */}
          <button
            onClick={handlePauseToggle}
            disabled={!state.track || state.isLoading}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
              showJumpToLive 
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {state.isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : showJumpToLive ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 18l8.5-6L4 6v12zM13 6v12l8.5-6L13 6z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => void handleReaction('fire')}
            disabled={!state.track || isVoting || state.source !== 'radio'}
            className={`h-12 w-12 rounded-full text-2xl transition ${
              selectedReaction === 'fire'
                ? 'bg-orange-500/20 ring-2 ring-orange-400'
                : 'bg-muted/40 hover:bg-orange-500/10'
            } disabled:opacity-50`}
            title="Fire reaction (also saves to your library)"
          >
            🔥
          </button>
        </div>

        {/* Volume Control */}
        <div className="mt-4 flex items-center justify-center space-x-3">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={state.volume}
            onInput={(e) =>
              handleVolumeInput((e.target as HTMLInputElement).value)
            }
            onChange={(e) => handleVolumeInput(e.target.value)}
            className="w-32 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
          <svg
            className="w-5 h-5 text-gray-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        </div>
        {isProspector && showRefineryPrompt && !refineryOpen && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">
                Do you want to rate this song?
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleRefineryPromptNo}>
                  No
                </Button>
                <Button size="sm" onClick={handleRefineryPromptYes}>
                  Yes
                </Button>
              </div>
            </div>
          </div>
        )}
        {isIosVolumeLocked && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            iPhone/iPad web limits volume control. Use device volume buttons.
          </p>
        )}
      </div>

      <Dialog open={refineryOpen} onOpenChange={setRefineryOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Refine that song (Prospector)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="refineScore">Refinement (1–10)</Label>
              <div className="flex items-center gap-3">
                <input
                  id="refineScore"
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={refineScore}
                  onChange={(e) => setRefineScore(parseInt(e.target.value, 10))}
                  className="w-full"
                />
                <div className="w-10 text-right font-semibold tabular-nums">{refineScore}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whereListen">Where would you listen?</Label>
                <Input
                  id="whereListen"
                  value={whereListen}
                  onChange={(e) => setWhereListen(e.target.value)}
                  placeholder="Car, gym, party…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remindsOf">What artist does it remind you of?</Label>
                <Input
                  id="remindsOf"
                  value={remindsOf}
                  onChange={(e) => setRemindsOf(e.target.value)}
                  placeholder="Artist / vibe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comments">Feedback (optional)</Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="What clicked? What didn’t?"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRefineryOpen(false)} disabled={isSubmittingRefinery}>
              Later
            </Button>
            <Button onClick={submitRefinery} disabled={isSubmittingRefinery}>
              {isSubmittingRefinery ? 'Submitting…' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
