'use client';

import { useEffect, useRef } from 'react';
import { mediaSessionArtworkEntries } from '@/lib/media-artwork';
import { usePlaybackOptional } from './PlaybackProvider';

/**
 * Drives iOS/Android lock-screen Now Playing metadata for the web radio player.
 */
export function MediaSessionSync() {
  const playback = usePlaybackOptional();
  const state = playback?.state;
  const actionsRef = useRef(playback?.actions);
  actionsRef.current = playback?.actions;

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const actions = actionsRef.current;
    if (!actions) return;

    const setHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Safari may reject unsupported actions.
      }
    };

    setHandler('play', () => {
      void actionsRef.current?.softResume();
    });
    setHandler('pause', () => {
      actionsRef.current?.softPause();
    });

    return () => {
      setHandler('play', null);
      setHandler('pause', null);
    };
  }, [playback?.actions]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const track = state?.track;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artistName,
      album: 'NETWORX Radio',
      artwork: mediaSessionArtworkEntries(track.artworkUrl),
    });
  }, [
    state?.track?.id,
    state?.track?.title,
    state?.track?.artistName,
    state?.track?.artworkUrl,
  ]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState =
      state?.isPlaying && !state?.pausedAt && !state?.isMuted ? 'playing' : 'paused';
  }, [state?.isPlaying, state?.pausedAt, state?.isMuted]);

  return null;
}
