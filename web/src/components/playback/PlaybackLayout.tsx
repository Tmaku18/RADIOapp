'use client';

import { PlaybackProvider } from './PlaybackProvider';
import { NowPlayingBar, NOW_PLAYING_BAR_HEIGHT } from './NowPlayingBar';

/**
 * Wraps the app with PlaybackProvider and renders the persistent Now Playing bar.
 * Add this once in the root layout so the bar is visible on all routes (marketing, auth, dashboard).
 */
export function PlaybackLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlaybackProvider>
      <div style={{ paddingBottom: NOW_PLAYING_BAR_HEIGHT }}>
        {children}
      </div>
      <NowPlayingBar />
    </PlaybackProvider>
  );
}
