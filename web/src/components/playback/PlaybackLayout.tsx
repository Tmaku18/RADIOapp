'use client';

import { usePathname } from 'next/navigation';
import { PlaybackProvider } from './PlaybackProvider';
import { NowPlayingBar, NOW_PLAYING_BAR_HEIGHT } from './NowPlayingBar';
import { RadioBackgroundSync } from './RadioBackgroundSync';
import { MediaSessionSync } from './MediaSessionSync';

/**
 * Wraps the app with PlaybackProvider and renders the persistent Now Playing bar.
 * Add this once in the root layout so the bar is visible on all routes (marketing, auth, dashboard).
 */
export function PlaybackLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Embed routes (e.g. the in-app WebView 3D hero) must be chrome-less and must
  // NOT spin up playback/heartbeat logic. Render the bare content only.
  if (pathname?.startsWith('/embed')) {
    return <>{children}</>;
  }

  return (
    <PlaybackProvider>
      <RadioBackgroundSync />
      <MediaSessionSync />
      <div style={{ paddingBottom: NOW_PLAYING_BAR_HEIGHT }}>
        {children}
      </div>
      <NowPlayingBar />
    </PlaybackProvider>
  );
}
