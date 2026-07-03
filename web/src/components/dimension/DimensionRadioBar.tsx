'use client';

import Link from 'next/link';
import { useRef } from 'react';
import {
  FastForward,
  Flame,
  Pause,
  Play,
  Rewind,
  Volume2,
} from 'lucide-react';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { useBassPulseRef } from '@/components/dimension/BassPulseLogo';
import { FrequencyVisualizer } from '@/components/radio/FrequencyVisualizer';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { signalRadioNavIntent } from '@/lib/playback-preferences';
import type { DimensionPlayerModel } from '@/hooks/useDimensionPlayer';

const MINI_VBAR_COUNT = 9;

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

/**
 * Progress track. For radio it is display-only (listeners stay glued to the
 * live position); for owned/library playback (`canSeek`) it is a click/drag
 * scrubber so the user can seek anywhere in the song.
 */
function ProgressTrack({ player }: { player: DimensionPlayerModel }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const canSeek = player.canSkip;

  const seekFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const percent = Math.min(
      100,
      Math.max(0, ((clientX - rect.left) / rect.width) * 100),
    );
    player.seekToProgress(percent);
  };

  if (!canSeek) {
    return (
      <div
        className="relative flex-1 h-1 dim-progress-track rounded-full overflow-hidden pointer-events-none"
        aria-label="Live radio progress"
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-pink-500 pointer-events-none"
          style={{ width: `${player.progress}%` }}
        />
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(player.progress)}
      tabIndex={0}
      data-testid="player-seek-track"
      className="pointer-events-auto relative flex-1 h-4 flex items-center cursor-pointer group touch-none select-none"
      onPointerDown={(e) => {
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) seekFromClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        draggingRef.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          player.seekPrev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          player.seekNext();
        }
      }}
    >
      <div className="relative w-full h-1 group-hover:h-1.5 transition-all dim-progress-track rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-pink-500"
          style={{ width: `${player.progress}%` }}
        />
      </div>
      <div
        className="absolute h-3 w-3 rounded-full bg-white shadow ring-2 ring-cyan-400/70 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
        style={{ left: `${player.progress}%` }}
        aria-hidden
      />
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
      className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-cyan-400/15 pointer-events-none"
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
          className="pointer-events-auto flex items-center gap-3 min-w-0 flex-1 lg:flex-none lg:w-72 hover:opacity-90 transition-opacity"
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
          <div className="pointer-events-auto hidden sm:flex shrink-0 border-l border-white/10 pl-3">
            <ReactionButtons player={player} />
          </div>
        ) : null}

        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <div className="pointer-events-auto flex items-center gap-3">
            {player.canSkip ? (
              <button
                type="button"
                onClick={player.seekPrev}
                data-testid="player-seek-back-btn"
                className="w-8 h-8 rounded-full bg-white/5 dim-text flex items-center justify-center hover:bg-white/10 transition-colors"
                aria-label="Back 10 seconds"
                title="Back 10s"
              >
                <Rewind className="w-4 h-4" />
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
                data-testid="player-seek-forward-btn"
                className="w-8 h-8 rounded-full bg-white/5 dim-text flex items-center justify-center hover:bg-white/10 transition-colors"
                aria-label="Forward 10 seconds"
                title="Forward 10s"
              >
                <FastForward className="w-4 h-4" />
              </button>
            ) : null}
            <div className="hidden md:flex items-end h-6 ml-2 w-[72px] shrink-0">
              <FrequencyVisualizer
                playing={player.isPlaying}
                barCount={MINI_VBAR_COUNT}
                className="h-6 w-full px-0 gap-[3px]"
                barClassName="min-w-[3px] flex-none w-[3px]"
              />
            </div>
            {player.canVote ? (
              <div className="pointer-events-auto sm:hidden ml-1">
                <ReactionButtons player={player} />
              </div>
            ) : null}
          </div>
          <div className="w-full max-w-2xl flex items-center gap-3">
            <span className="font-dim-mono text-[10px] dim-text-subtle w-8 text-right shrink-0">
              {player.elapsedLabel}
            </span>
            <ProgressTrack player={player} />
            <span className="font-dim-mono text-[10px] dim-text-subtle w-8 shrink-0">
              {player.totalLabel}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto hidden lg:flex items-center gap-4 w-72 justify-end shrink-0">
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
