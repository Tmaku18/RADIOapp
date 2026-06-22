'use client';

import Link from 'next/link';
import {
  Flame,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { useBassPulseRef } from '@/components/dimension/BassPulseLogo';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { signalRadioNavIntent } from '@/lib/playback-preferences';
import type { DimensionPlayerModel } from '@/hooks/useDimensionPlayer';

const VBAR_DELAYS = [0.1, 0.3, 0.2, 0.4, 0.25, 0.35, 0.15, 0.5, 0.2];

function ReactionButtons({ player }: { player: DimensionPlayerModel }) {
  if (!player.canVote) return null;

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => player.submitReaction('shit')}
        disabled={player.isVoting}
        data-testid="player-shit-btn"
        aria-label="Pass vote"
        title="Pass"
        className={`h-8 w-8 rounded-full text-base leading-none transition ${
          player.selectedReaction === 'shit'
            ? 'bg-emerald-600/20 ring-2 ring-emerald-400'
            : 'bg-white/5 hover:bg-emerald-600/10'
        } disabled:opacity-40`}
      >
        💩
      </button>
      <button
        type="button"
        onClick={() => player.submitReaction('fire')}
        disabled={player.isVoting}
        data-testid="player-fire-btn"
        aria-label="Fire vote"
        title="Fire"
        className={`h-8 w-8 rounded-full text-base leading-none transition ${
          player.selectedReaction === 'fire'
            ? 'bg-orange-500/20 ring-2 ring-orange-400'
            : 'bg-white/5 hover:bg-orange-500/10'
        } disabled:opacity-40`}
      >
        🔥
      </button>
    </div>
  );
}

type DimensionRadioBarProps = {
  player: DimensionPlayerModel;
};

export function DimensionRadioBar({ player }: DimensionRadioBarProps) {
  const playback = usePlaybackOptional();
  const artRef = useBassPulseRef(playback?.bassRef);
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
          onClick={() => {
            if (player.listenHref.startsWith('/listen')) {
              signalRadioNavIntent();
            }
          }}
          className="flex items-center gap-3 min-w-0 flex-1 lg:flex-none lg:w-72 hover:opacity-90 transition-opacity"
        >
          <div
            ref={artRef}
            className="relative w-12 h-12 rounded overflow-hidden border border-cyan-400/40 shrink-0 bg-muted/40 transition-shadow duration-75"
          >
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

        {player.canVote ? (
          <div className="hidden sm:flex shrink-0 border-l border-white/10 pl-3">
            <ReactionButtons player={player} />
          </div>
        ) : null}

        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <div className="flex items-center gap-3">
            {player.canSkip ? (
              <button
                type="button"
                onClick={player.seekPrev}
                data-testid="player-prev-btn"
                className="dim-text-muted hover:text-cyan-300 transition-colors"
                aria-label="Seek back 10 seconds"
              >
                <SkipBack className="w-4 h-4" />
              </button>
            ) : null}
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
            {player.canSkip ? (
              <button
                type="button"
                onClick={player.seekNext}
                data-testid="player-next-btn"
                className="dim-text-muted hover:text-cyan-300 transition-colors"
                aria-label="Seek forward 10 seconds"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            ) : null}
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
            {player.canVote ? (
              <div className="sm:hidden ml-1">
                <ReactionButtons player={player} />
              </div>
            ) : null}
          </div>
          <div className="w-full max-w-2xl flex items-center gap-3">
            <span className="font-dim-mono text-[10px] dim-text-subtle w-8 text-right shrink-0">
              {player.elapsedLabel}
            </span>
            <button
              type="button"
              className={`relative flex-1 h-1 dim-progress-track rounded-full overflow-hidden ${
                player.canSkip ? '' : 'pointer-events-none'
              }`}
              onClick={(e) => {
                if (!player.canSkip) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = ((e.clientX - rect.left) / rect.width) * 100;
                player.seekToProgress(pct);
              }}
              aria-label={
                player.canSkip ? 'Seek playback position' : 'Live radio progress'
              }
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
            <Flame className="w-4 h-4 text-yellow-300" />
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
