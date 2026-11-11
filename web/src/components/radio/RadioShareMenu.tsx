'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import {
  artistShareText,
  shareLink,
  stationDisplayName,
  stationShareText,
  stationShareUrl,
  artistShareUrl,
} from '@/lib/radio-share';

type RadioShareMenuProps = {
  stationId?: string | null;
  artistId?: string | null;
  artistName?: string | null;
  songId?: string | null;
  songTitle?: string | null;
  compact?: boolean;
  className?: string;
};

export function RadioShareMenu({
  stationId,
  artistId,
  artistName,
  songId,
  songTitle,
  compact = false,
  className = '',
}: RadioShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const station = stationId?.trim() || '';
  const artist = artistId?.trim() || '';

  const flash = (message: string | null) => {
    setFeedback(message);
    if (!message) return;
    window.setTimeout(() => setFeedback(null), 2500);
  };

  const shareStation = async () => {
    if (!station) return;
    setOpen(false);
    const result = await shareLink(stationShareText(station), stationShareUrl(station));
    if (result === 'copied') flash('Station link copied');
    if (result === 'failed') flash('Could not share');
  };

  const shareArtist = async () => {
    if (!artist) return;
    setOpen(false);
    const text = artistShareText({
      artistId: artist,
      artistName: artistName || 'This artist',
      songId,
      songTitle,
    });
    const result = await shareLink(text, artistShareUrl(artist, songId));
    if (result === 'copied') flash('Artist link copied');
    if (result === 'failed') flash('Could not share');
  };

  if (!station && !artist) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        data-testid="radio-share"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Share"
        className={
          compact
            ? 'w-8 h-8 rounded-full bg-white/5 dim-text flex items-center justify-center hover:bg-white/10 transition-colors'
            : 'h-10 px-4 rounded-full border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10 text-xs font-dim-mono tracking-[0.18em] uppercase transition inline-flex items-center gap-2'
        }
      >
        <Share2 className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        {compact ? <span className="sr-only">Share</span> : feedback ?? 'Share'}
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Close share menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute left-0 top-12 z-40 min-w-56 rounded-xl border border-white/10 bg-zinc-950/95 p-1 text-left shadow-xl"
          >
            {station ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => void shareStation()}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10"
              >
                Share {stationDisplayName(station)}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              disabled={!artist}
              onClick={() => void shareArtist()}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10 disabled:opacity-40"
            >
              Share artist page
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
