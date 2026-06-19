'use client';

import Link from 'next/link';
import {
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import type { DimensionPlayerModel } from '@/hooks/useDimensionPlayer';

const VBAR_DELAYS = [0.1, 0.3, 0.2, 0.4, 0.25, 0.35, 0.15, 0.5, 0.2];

type DimensionRadioBarProps = {
  player: DimensionPlayerModel;
};

export function DimensionRadioBar({ player }: DimensionRadioBarProps) {
  const tempLabel =
    player.temperature != null ? `${player.temperature}°` : '—';

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-cyan-400/15"
      aria-label="Now playing"
      data-dimension
      data-testid="radio-player"
    >
      <div className="neon-line" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex items-center gap-4">
        <Link
          href={player.listenHref}
          className="flex items-center gap-3 min-w-0 flex-1 lg:flex-none lg:w-72 hover:opacity-90 transition-opacity"
        >
          <div className="relative w-12 h-12 rounded overflow-hidden border border-white/10 shrink-0 bg-muted/40">
            <ArtworkImage
              src={player.artworkUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="min-w-0">
            {player.showLiveBadge ? (
              <div className="flex items-center gap-2">
                <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-pink-500" />
                <span className="font-dim-mono text-[10px] tracking-[0.25em] text-pink-400">
                  LIVE
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-dim-mono text-[10px] tracking-[0.25em] dim-text-subtle">
                  NETWORX
                </span>
              </div>
            )}
            <div
              data-testid="player-song-title"
              className="font-unbounded font-bold text-sm truncate dim-text"
            >
              {player.title}
            </div>
            <div className="font-dim-mono text-[10px] dim-text-muted truncate">
              {player.artist}
            </div>
          </div>
        </Link>

        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={player.seekPrev}
              disabled={!player.canSkip}
              data-testid="player-prev-btn"
              className="dim-text-muted hover:text-cyan-300 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              aria-label={
                player.canSkip
                  ? 'Seek back 10 seconds'
                  : 'Skip unavailable on live radio'
              }
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={player.togglePlay}
              disabled={!player.canTransport}
              data-testid="player-play-btn"
              className="w-10 h-10 rounded-full bg-cyan-400 text-black flex items-center justify-center glow-cyan hover:bg-cyan-300 transition-colors disabled:opacity-40"
              aria-label={player.isPlaying ? 'Pause' : 'Play'}
            >
              {player.isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={player.seekNext}
              disabled={!player.canSkip}
              data-testid="player-next-btn"
              className="dim-text-muted hover:text-cyan-300 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              aria-label={
                player.canSkip
                  ? 'Seek forward 10 seconds'
                  : 'Skip unavailable on live radio'
              }
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <div className="hidden md:flex items-end gap-[3px] h-6 ml-2">
              {VBAR_DELAYS.map((d, i) => (
                <span
                  key={i}
                  className="vbar w-[3px] h-full bg-gradient-to-t from-cyan-400 to-pink-500 rounded-sm"
                  style={{
                    animationDelay: `${d}s`,
                    animationPlayState: player.isPlaying ? 'running' : 'paused',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="w-full max-w-2xl flex items-center gap-3">
            <span className="font-dim-mono text-[10px] dim-text-subtle w-8 text-right shrink-0">
              {player.elapsedLabel}
            </span>
            <button
              type="button"
              className="relative flex-1 h-1 dim-progress-track rounded-full overflow-hidden"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = ((e.clientX - rect.left) / rect.width) * 100;
                player.seekToProgress(pct);
              }}
              aria-label="Seek playback position"
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-pink-500 pointer-events-none"
                style={{ width: `${player.progress}%` }}
              />
            </button>
            <span className="font-dim-mono text-[10px] dim-text-subtle w-8 shrink-0">
              {player.totalLabel}
            </span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4 w-72 justify-end shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-300" />
            <span className="font-dim-mono text-[10px] tracking-[0.2em] dim-text-muted">
              TEMP
            </span>
            <span className="font-unbounded font-black text-cyan-300 text-sm">
              {tempLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 w-32">
            <Volume2 className="w-4 h-4 dim-text-muted shrink-0" />
            <input
              type="range"
              min="0"
              max="100"
              value={player.volume}
              onChange={(e) => player.setVolume(+e.target.value)}
              data-testid="player-volume"
              className="w-full accent-cyan-400"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Approximate fixed height for layout padding (matches 3d pb-28). */
export const DIMENSION_RADIO_BAR_HEIGHT = 112;
