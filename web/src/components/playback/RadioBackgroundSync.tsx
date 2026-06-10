'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { radioApi } from '@/lib/api';
import { parseDjOverlay, subscribeDjBoothEvents } from '@/lib/dj-booth-listener';
import type { PlaybackTrack } from './types';
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
    artworkUrl: (trackData.artwork_url as string | null) ?? null,
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
  const actionsRef = useRef(playback?.actions);
  actionsRef.current = playback?.actions;

  const state = playback?.state;
  const setOnRadioTrackEnded = playback?.setOnRadioTrackEnded;
  const radioPlayerUiActive = playback?.radioPlayerUiActive ?? false;

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
        actions.loadTrack(track, 'radio', autoPlay && !transportPaused);
        actions.syncToPosition(serverPosition);
        return;
      }

      actions.syncToPosition(serverPosition);
    },
    [radioId],
  );

  const syncCurrentTrack = useCallback(async () => {
    if (!actionsRef.current || !radioId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const response = await radioApi.getCurrentTrack(radioId);
      const trackData = response.data as Record<string, unknown>;
      if (trackData?.no_content) return;
      applyServerTrack(trackData, state?.isPlaying ?? false);
    } catch {
      // Background sync should not interrupt playback UX.
    } finally {
      isFetchingRef.current = false;
    }
  }, [radioId, applyServerTrack, state?.isPlaying]);

  const fetchNextTrack = useCallback(async () => {
    if (!actionsRef.current || !radioIdRef.current || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const response = await radioApi.getNextTrack({
        radio: radioIdRef.current,
        force: false,
      });
      const trackData = response.data as Record<string, unknown>;
      if (trackData?.no_content || !trackData?.id) return;
      applyServerTrack(trackData, true);
    } catch {
      // Retry on next poll.
    } finally {
      isFetchingRef.current = false;
    }
  }, [applyServerTrack]);

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
