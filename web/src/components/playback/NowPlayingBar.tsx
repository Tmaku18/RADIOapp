'use client';

import Link from 'next/link';
import { usePlaybackOptional } from './PlaybackProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BAR_HEIGHT = 72;

/**
 * Spotify-style persistent mini-player bar. Visible on all pages when wrapped in PlaybackProvider.
 * Clicking the bar expands to the full Listen page (/listen).
 */
export function NowPlayingBar() {
  const playback = usePlaybackOptional();
  const state = playback?.state;
  const actions = playback?.actions;

  const hasTrack = !!state?.track;
  const track = state?.track;
  const isPlaying = state?.isPlaying ?? false;

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ height: BAR_HEIGHT }}
      aria-label="Now playing"
    >
      <div className="h-full px-4 flex items-center gap-3 max-w-full">
        <Link
          href="/listen"
          className={cn(
            'flex items-center gap-3 min-w-0 flex-1 rounded-md transition-colors',
            hasTrack && 'hover:bg-muted/50',
          )}
          aria-label={hasTrack ? 'Expand to full player' : 'Go to Radio'}
        >
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/60 shrink-0 flex items-center justify-center">
            {track?.artworkUrl ? (
              // Use <img> for dynamic remote artwork to avoid optimizer 400 loops.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.artworkUrl}
                alt=""
                className="object-cover w-full h-full"
                onError={(e) => {
                  // Hide broken artwork if URL is invalid/expired.
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="text-xl text-muted-foreground">🎵</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate text-sm text-foreground">
              {track?.title ?? 'Radio'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {track?.artistName ?? 'Tap to start listening'}
            </p>
          </div>
        </Link>

        {actions && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void actions.togglePlay()}
              disabled={!hasTrack && !state?.source}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <span className="text-lg">⏸</span>
              ) : (
                <span className="text-lg">▶</span>
              )}
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Expand player">
              <Link href="/listen">
                <span className="text-sm font-medium">Expand</span>
              </Link>
            </Button>
          </div>
        )}
      </div>
    </footer>
  );
}

/** Height of the now-playing bar for layout padding. */
export const NOW_PLAYING_BAR_HEIGHT = BAR_HEIGHT;
