'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { radioApi } from '@/lib/api';
import { parseDjOverlay, subscribeDjBoothEvents } from '@/lib/dj-booth-listener';
import { isNearRadioTrackEnd, isServerAheadMidSong } from '@/lib/radio-sync';
import type { PlaybackTrack } from './types';
import { resolveTrackArtworkUrl } from '@/lib/media-artwork';
import { getLastRadioStationId } from '@/lib/playback-preferences';
import { DEFAULT_STATION_ID } from '@/data/station-map';
import { usePlaybackOptional } from './PlaybackProvider';

const BACKGROUND_POLL_MS = 10000;

function trackFromPayload(
  trackData: Record<string, unknown>,
  radioId: string,
): PlaybackTrack | null {
  const audioUrl = trackData.audio_url;
  if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) return null;
  if (!trackData.id || typeof trackData.id !== 'string') return null;
  return {
    id: trackData.id,
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
}

/**
 * Keeps radio playback aligned with the server when the full RadioPlayer UI is not mounted
 * (collapsed mini-player on admin and other dashboard routes).
 */
export function RadioBackgroundSync() {
  const pathname = usePathname();
  const playback = usePlaybackOptional();
  const isFetchingRef = useRef(false);
  const trackIdRef = useRef<string | null>(null);
  const radioIdRef = useRef<string | null>(null);
  const initAttemptedRef = useRef(false);
  const actionsRef = useRef(playback?.actions);
  actionsRef.current = playback?.actions;

  const state = playback?.state;
  const setOnRadioTrackEnded = playback?.setOnRadioTrackEnded;
  const radioPlayerUiActive = playback?.radioPlayerUiActive ?? false;
  const isStaleRadioServerTrack = playback?.isStaleRadioServerTrack;

  const isListenPage = pathname === '/listen';
  const isDjBoothPage = pathname.startsWith('/admin/dj-booth');
  const shouldSync =
    !isListenPage &&
    !isDjBoothPage &&
    !radioPlayerUiActive &&
    state?.source === 'radio' &&
    !!state.track?.radioId;

  const radioId = state?.track?.radioId?.trim() || null;

  useEffect(() => {
    trackIdRef.current = state?.track?.id ?? null;
    radioIdRef.current = radioId;
  }, [state?.track?.id, radioId]);

  const applyServerTrack = useCallback(
    (trackData: Record<string, unknown>, autoPlay: boolean) => {
      const actions = actionsRef.current;
      if (!actions || !radioId) return;
      const track = trackFromPayload(trackData, radioId);
      if (!track) return;

      const serverPosition = Number(trackData.position_seconds) || 0;
      const transportPaused = !!trackData.transport_paused;
      const currentId = trackIdRef.current;

      actions.applyServerBoothState({
        transportPaused,
        djOverlay: parseDjOverlay(trackData.dj_overlay),
      });

      if (currentId !== track.id) {
        // Server may still report the previous song while we've already
        // crossfaded ahead via /radio/peek. Don't revert (jump backward).
        if (isStaleRadioServerTrack?.(track.id)) return;

        const playing = state?.isPlaying ?? false;
        const pausedAt = state?.pausedAt ?? null;
        const currentTime = state?.currentTime ?? 0;
        const duration = state?.duration ?? 0;
        const fallbackDuration = state?.track?.durationSeconds;

        if (
          currentId &&
          isServerAheadMidSong({
            trackIdentityChanged: true,
            isPlaying: playing,
            pausedAt,
            currentTime,
            duration,
            fallbackDurationSeconds: fallbackDuration,
          })
        ) {
          return;
        }

        // Join at the live server offset so background/mini-player listeners
        // stay aligned with everyone else (true-radio sync).
        actions.loadTrack(
          track,
          'radio',
          autoPlay && !transportPaused && pausedAt == null,
          serverPosition,
        );
        actions.syncToPosition(serverPosition);
        return;
      }

      if (state?.pausedAt == null) {
        actions.syncToPosition(serverPosition);
      }
    },
    [radioId, isStaleRadioServerTrack, state?.isPlaying, state?.pausedAt, state?.currentTime, state?.duration, state?.track?.durationSeconds],
  );

  const syncCurrentTrack = useCallback(async () => {
    if (!actionsRef.current || !radioId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const response = await radioApi.getCurrentTrack(radioId);
      const trackData = response.data as Record<string, unknown>;
      if (trackData?.no_content) return;
      applyServerTrack(trackData, (state?.isPlaying ?? false) && state?.pausedAt == null);
    } catch {
      // Background sync should not interrupt playback UX.
    } finally {
      isFetchingRef.current = false;
    }
  }, [radioId, applyServerTrack, state?.isPlaying, state?.pausedAt]);

  const fetchNextTrack = useCallback(async () => {
    if (!actionsRef.current || !radioIdRef.current || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const response = await radioApi.getNextTrack({
        radio: radioIdRef.current,
        force: true,
      });
      const trackData = response.data as Record<string, unknown>;
      if (trackData?.no_content || !trackData?.id) return;
      applyServerTrack(trackData, state?.pausedAt == null);
    } catch {
      // Retry on next poll.
    } finally {
      isFetchingRef.current = false;
    }
  }, [applyServerTrack, state?.pausedAt]);

  useEffect(() => {
    if (!shouldSync || !setOnRadioTrackEnded) return;
    setOnRadioTrackEnded(fetchNextTrack);
    return () => setOnRadioTrackEnded(null);
  }, [shouldSync, setOnRadioTrackEnded, fetchNextTrack]);

  useEffect(() => {
    if (!shouldSync) return;
    void syncCurrentTrack();
    const interval = setInterval(() => void syncCurrentTrack(), BACKGROUND_POLL_MS);
    return () => clearInterval(interval);
  }, [shouldSync, syncCurrentTrack]);

  // Background tabs throttle the interval above; re-sync promptly on refocus.
  useEffect(() => {
    if (!shouldSync || typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncCurrentTrack();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [shouldSync, syncCurrentTrack]);

  // Populate the persistent now-playing bar with the current live track for
  // everyone — including logged-out visitors on marketing pages — so the radio
  // is one tap away from anywhere. Loads without autoplay (browsers require a
  // user gesture); the play button in the bar starts audio. The full /listen
  // RadioPlayer manages its own loading, so skip there.
  useEffect(() => {
    if (initAttemptedRef.current) return;
    if (radioPlayerUiActive) return;
    // Don't clobber a non-radio source (e.g. discography) or an existing track.
    if (state?.track || (state?.source && state.source !== 'radio')) return;

    initAttemptedRef.current = true;
    let cancelled = false;
    void (async () => {
      const stationId = getLastRadioStationId() || DEFAULT_STATION_ID;
      try {
        const response = await radioApi.getCurrentTrack(stationId);
        if (cancelled) return;
        const trackData = response.data as Record<string, unknown>;
        if (trackData?.no_content || !trackData?.id) {
          initAttemptedRef.current = false;
          return;
        }
        const track = trackFromPayload(trackData, stationId);
        const actions = actionsRef.current;
        if (track && actions) {
          actions.loadTrack(
            track,
            'radio',
            false,
            Number(trackData.position_seconds) || null,
          );
        }
      } catch {
        // Allow a retry on a later render if the first attempt failed.
        initAttemptedRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [radioPlayerUiActive, state?.track, state?.source]);

  useEffect(() => {
    if (!shouldSync || !radioId) return;
    return subscribeDjBoothEvents(radioId, (event) => {
      const actions = actionsRef.current;
      if (!actions) return;
      actions.handleDjBoothEvent(event);
      if (event.type === 'transport_pause' && typeof event.positionSeconds === 'number') {
        actions.syncToPosition(event.positionSeconds);
      } else if (event.type === 'transport_play' && typeof event.positionSeconds === 'number') {
        actions.syncToPosition(event.positionSeconds);
      } else if (event.type === 'queue_updated') {
        void syncCurrentTrack();
      }
    });
  }, [shouldSync, radioId, syncCurrentTrack]);

  return null;
}
