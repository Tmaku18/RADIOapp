'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { usePlaybackOptional } from './PlaybackProvider';
import { DimensionRadioBar, DIMENSION_RADIO_BAR_HEIGHT } from '@/components/dimension/DimensionRadioBar';
import { useDimensionPlayer } from '@/hooks/useDimensionPlayer';
import { useAuth } from '@/contexts/AuthContext';
import { hasListenerCapability } from '@/lib/roles';
import { radioApi } from '@/lib/api';

/**
 * Persistent Emergent bottom radio bar. Visible on all pages when wrapped in PlaybackProvider.
 * Wired to PlaybackProvider via useDimensionPlayer (not mock PlayerContext).
 */
export function NowPlayingBar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const playback = usePlaybackOptional();
  const state = playback?.state;
  const player = useDimensionPlayer();
  const streamTokenRef = useRef<string | null>(null);

  const track = state?.track;
  const activeRadioId = track?.radioId?.trim() || null;
  const isPlaying = (state?.isPlaying ?? false) && !state?.pausedAt;
  const canSendAuthenticatedHeartbeat = hasListenerCapability(profile?.role);

  useEffect(() => {
    if (streamTokenRef.current) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.crypto !== 'undefined' &&
      typeof window.crypto.randomUUID === 'function'
    ) {
      streamTokenRef.current = `npb-${window.crypto.randomUUID()}`;
      return;
    }
    streamTokenRef.current = `npb-${Date.now()}`;
  }, []);

  // Keep listener presence alive when radio audio continues outside the /listen page.
  // Guests (logged out) send presence only; signed-in Prospectors also heartbeat for yield.
  useEffect(() => {
    if (pathname === '/listen') return;
    if (state?.source !== 'radio') return;
    if (!isPlaying) return;
    const streamToken = streamTokenRef.current;
    if (!streamToken) return;
    const songId = track?.id;
    if (!songId) return;

    let cancelled = false;
    const heartbeatIntervalMs = 30000;
    const send = async () => {
      try {
        await radioApi.sendPresence(
          {
            streamToken,
            songId,
            timestamp: new Date().toISOString(),
          },
          activeRadioId ?? undefined,
        );
        if (canSendAuthenticatedHeartbeat) {
          await radioApi.sendHeartbeat(
            {
              streamToken,
              songId,
              timestamp: new Date().toISOString(),
            },
            activeRadioId ?? undefined,
          );
        }
      } catch {
        // Presence heartbeat should not block playback UX.
      }
    };

    void send();
    const interval = setInterval(() => {
      if (!cancelled) void send();
    }, heartbeatIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    pathname,
    canSendAuthenticatedHeartbeat,
    state?.source,
    isPlaying,
    track?.id,
    activeRadioId,
  ]);

  return <DimensionRadioBar player={player} />;
}

/** Height of the now-playing bar for layout padding. */
export const NOW_PLAYING_BAR_HEIGHT = DIMENSION_RADIO_BAR_HEIGHT;
