'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePlaybackOptional } from './PlaybackProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { RadioPlayer } from '@/components/radio/RadioPlayer';

const BAR_HEIGHT = 72;

/**
 * Spotify-style persistent mini-player bar. Visible on all pages when wrapped in PlaybackProvider.
 * Clicking the bar expands to the full Listen page (/listen).
 */
export function NowPlayingBar() {
  const [expanded, setExpanded] = useState(false);
  const playback = usePlaybackOptional();
  const state = playback?.state;
  const actions = playback?.actions;

  const hasTrack = !!state?.track;
  const track = state?.track;
  const activeRadioId = track?.radioId?.trim() || null;
  const isPlaying = state?.isPlaying ?? false;

  return (
    <>
      {expanded && (
        <div className="fixed inset-x-0 bottom-[72px] z-40 max-h-[82vh] overflow-auto border-t border-border bg-background">
          <div className="mx-auto w-full max-w-xl p-3">
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>
                Collapse
              </Button>
            </div>
            <RadioPlayer radioId={activeRadioId ?? undefined} />
          </div>
        </div>
      )}
      <footer
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ height: BAR_HEIGHT }}
        aria-label="Now playing"
      >
        <div className="h-full px-4 flex items-center gap-3 max-w-full">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
          className={cn(
            'flex items-center gap-3 min-w-0 flex-1 rounded-md transition-colors',
            hasTrack && 'hover:bg-muted/50',
          )}
          aria-label={expanded ? 'Collapse player' : 'Expand player'}
        >
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/60 shrink-0 flex items-center justify-center">
            <ArtworkImage
              src={track?.artworkUrl}
              alt=""
              className="object-cover w-full h-full"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate text-sm text-foreground">
              {track?.title ?? 'Radio'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {track?.artistName ?? 'Tap to open player'}
            </p>
          </div>
          </button>

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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? 'Collapse player' : 'Expand player'}
              >
                {expanded ? 'Hide' : 'Expand'}
              </Button>
              <Button variant="ghost" size="sm" asChild aria-label="Open full player page">
                <Link
                  href={
                    activeRadioId
                      ? `/listen?station=${encodeURIComponent(activeRadioId)}`
                      : '/listen'
                  }
                >
                  Page
                </Link>
              </Button>
            </div>
          )}
        </div>
      </footer>
    </>
  );
}

/** Height of the now-playing bar for layout padding. */
export const NOW_PLAYING_BAR_HEIGHT = BAR_HEIGHT;
