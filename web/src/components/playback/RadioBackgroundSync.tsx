'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { radioApi } from '@/lib/api';
import { parseDjOverlay, subscribeDjBoothEvents } from '@/lib/dj-booth-listener';
import {
  isNearRadioTrackEnd,
  isServerAheadMidSong,
  resolveNextTrackAfterEnd,
} from '@/lib/radio-sync';
import type { PlaybackTrack } from './types';
import { resolveTrackArtworkUrl } from '@/lib/media-artwork';
import { getLastRadioStationId, setLastRadioStationId } from '@/lib/playback-preferences';
import { DEFAULT_STATION_ID } from '@/data/station-map';
import { usePlaybackOptional } from './PlaybackProvider';

const BACKGROUND_POLL_MS = 10000;
const HIDDEN_TAB_POLL_MS = 5000;

/** Marketing home always tunes Ready Now Radio; other routes respect last station. */
function resolveBootstrapStationId(pathname: string | null): string {
  if (pathname === '/') return DEFAULT_STATION_ID;
  return getLastRadioStationId() || DEFAULT_STATION_ID;
}

async function loadStationIntoBar(
  stationId: string,
  autoPlay: boolean,
  actions: NonNullable<ReturnType<typeof usePlaybackOptional>>['actions'],
): Promise<boolean> {
  const response = await radioApi.getCurrentTrack(stationId);
  const trackData = response.data as Record<string, unknown>;
  if (trackData?.no_content || !trackData?.id) return false;
  const track = trackFromPayload(trackData, stationId);
  if (!track) return false;
  actions.loadTrack(
    track,
    'radio',
    autoPlay,
    Number(trackData.position_seconds) || null,
  );
  setLastRadioStationId(stationId);
  return true;
}

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
  const [documentHidden, setDocumentHidden] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = () => setDocumentHidden(document.visibilityState === 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const shouldSync =
    !isDjBoothPage &&
    state?.source === 'radio' &&
    !!state.track?.radioId &&
    (documentHidden || (!isListenPage && !radioPlayerUiActive));

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
      applyServerTrack(trackData, state?.pausedAt == null && ((state?.isPlaying ?? false) || !!state?.isMuted));
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
      const endedTrackId = trackIdRef.current;
      const trackData = await resolveNextTrackAfterEnd({
        radioId: radioIdRef.current,
        endedTrackId,
        isStaleRadioServerTrack:
          isStaleRadioServerTrack ?? (() => false),
        getNextTrack: (params) => radioApi.getNextTrack(params),
      });
      if (!trackData || trackData.no_content || !trackData.id) return;
      applyServerTrack(
        trackData as Record<string, unknown>,
        state?.pausedAt == null && ((state?.isPlaying ?? false) || !!state?.isMuted),
      );
    } catch {
      // Retry on next poll.
    } finally {
      isFetchingRef.current = false;
    }
  }, [applyServerTrack, isStaleRadioServerTrack, state?.isMuted, state?.isPlaying, state?.pausedAt]);

  useEffect(() => {
    if (!shouldSync || !setOnRadioTrackEnded) return;
    setOnRadioTrackEnded(fetchNextTrack);
    // Do not clear on cleanup — RadioPlayer re-registers on the listen page when
    // visible; clearing here left onRadioTrackEnded null and caused ended tracks
    // to replay from the start on one client.
  }, [shouldSync, setOnRadioTrackEnded, fetchNextTrack]);

  useEffect(() => {
    if (!shouldSync) return;
    void syncCurrentTrack();
    const pollMs = documentHidden ? HIDDEN_TAB_POLL_MS : BACKGROUND_POLL_MS;
    const interval = setInterval(() => void syncCurrentTrack(), pollMs);
    return () => clearInterval(interval);
  }, [shouldSync, syncCurrentTrack, documentHidden]);

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
      const stationId = resolveBootstrapStationId(pathname);
      try {
        const actions = actionsRef.current;
        if (!actions) {
          initAttemptedRef.current = false;
          return;
        }
        const ok = await loadStationIntoBar(stationId, false, actions);
        if (cancelled) return;
        if (!ok) initAttemptedRef.current = false;
      } catch {
        // Allow a retry on a later render if the first attempt failed.
        initAttemptedRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [radioPlayerUiActive, state?.track, state?.source, pathname]);

  // Marketing home (/) always shows Ready Now Radio in the bottom bar.
  useEffect(() => {
    if (pathname !== '/') return;
    if (radioPlayerUiActive) return;
    if (state?.source && state.source !== 'radio') return;

    const currentRadioId = state?.track?.radioId?.trim();
    if (currentRadioId === DEFAULT_STATION_ID && state?.track) return;

    let cancelled = false;
    void (async () => {
      const actions = actionsRef.current;
      if (!actions) return;
      try {
        await loadStationIntoBar(DEFAULT_STATION_ID, false, actions);
      } catch {
        if (!cancelled) {
          // no-op — bootstrap or next navigation can retry
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    pathname,
    radioPlayerUiActive,
    state?.source,
    state?.track,
    state?.track?.radioId,
  ]);

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
