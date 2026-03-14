'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePlayback } from '@/components/playback';
import type { PlaybackTrack } from '@/components/playback';
import { ArtworkImage } from '@/components/common/ArtworkImage';

export type DiscographyTrack = {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  audioUrl: string | null;
  artworkUrl: string | null;
  durationSeconds?: number | null;
  likeCount?: number | null;
  individualListenCount?: number | null;
  liked?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function formatCount(n?: number | null): string {
  return new Intl.NumberFormat().format(Math.max(0, n ?? 0));
}

type Props = {
  tracks: DiscographyTrack[];
  onToggleLike?: (trackId: string, nextLiked: boolean) => Promise<void> | void;
  onRecordListen?: (trackId: string) => Promise<void> | void;
};

function toPlaybackTrack(t: DiscographyTrack): PlaybackTrack {
  return {
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    artistId: t.artistId,
    artworkUrl: t.artworkUrl ?? null,
    audioUrl: t.audioUrl ?? '',
    durationSeconds: t.durationSeconds ?? 0,
  };
}

export function DiscographyPlayer({ tracks, onToggleLike, onRecordListen }: Props) {
  const { state, actions } = usePlayback();
  const [seeking, setSeeking] = useState(false);
  const recordedForTrackRef = useRef<Set<string>>(new Set());

  const isDiscographyActive = state.source === 'discography' && !!state.track;
  const activeId = isDiscographyActive ? state.track!.id : null;
  const activeIndex = useMemo(() => tracks.findIndex((t) => t.id === activeId), [tracks, activeId]);
  const activeTrack = useMemo(() => (activeIndex >= 0 ? tracks[activeIndex] : null), [tracks, activeIndex]);
  const isPlaying = state.isPlaying;
  const currentTime = state.currentTime;
  const duration = state.duration;
  const volume = state.volume;

  const canPrev = activeIndex > 0;
  const canNext = activeIndex >= 0 && activeIndex < tracks.length - 1;

  const playIndex = useCallback(
    async (index: number, autoPlay = false) => {
      const t = tracks[index];
      if (!t?.audioUrl) return;
      actions.loadTrack(toPlaybackTrack(t), 'discography');
      if (autoPlay) await actions.play();
    },
    [actions, tracks],
  );

  const togglePlay = useCallback(async () => {
    if (!activeTrack) {
      const idx = tracks.findIndex((t) => !!t.audioUrl);
      if (idx >= 0) await playIndex(idx, true);
      return;
    }
    await actions.togglePlay();
  }, [activeTrack, actions, playIndex, tracks]);

  const handleRowPlay = useCallback(
    async (trackId: string) => {
      const idx = tracks.findIndex((t) => t.id === trackId);
      if (idx < 0) return;
      if (activeId === trackId && isPlaying) {
        actions.pause();
        return;
      }
      if (activeId === trackId && !isPlaying) {
        await actions.play();
        return;
      }
      await playIndex(idx, true);
    },
    [activeId, isPlaying, actions, playIndex, tracks],
  );

  const onSeekChange = useCallback(
    (value: number) => {
      actions.seek(clamp(value, 0, Number.isFinite(duration) ? duration : value));
    },
    [actions, duration],
  );

  // 30s listen recording when playing from discography
  useEffect(() => {
    if (state.source !== 'discography' || !state.track?.id || !onRecordListen) return;
    if (state.currentTime >= 30 && !recordedForTrackRef.current.has(state.track.id)) {
      recordedForTrackRef.current.add(state.track.id);
      onRecordListen(state.track.id);
    }
  }, [state.source, state.track?.id, state.currentTime, onRecordListen]);

  const likeBusyRef = useRef<Set<string>>(new Set());
  const [likeBusyTick, setLikeBusyTick] = useState(0);
  const isLikeBusy = (id: string) => likeBusyRef.current.has(id);

  const toggleLike = useCallback(
    async (t: DiscographyTrack) => {
      if (!onToggleLike) return;
      if (isLikeBusy(t.id)) return;
      likeBusyRef.current.add(t.id);
      setLikeBusyTick((x) => x + 1);
      try {
        await onToggleLike(t.id, !t.liked);
      } finally {
        likeBusyRef.current.delete(t.id);
        setLikeBusyTick((x) => x + 1);
      }
    },
    [onToggleLike],
  );

  return (
    <div className="space-y-4">
      {/* Track list */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold">Discography</p>
            <p className="text-xs text-muted-foreground">Unlimited plays. Likes here affect the leaderboard.</p>
          </div>
          <div className="text-xs text-muted-foreground font-mono">{tracks.length} tracks</div>
        </div>

        <ul className="divide-y divide-border">
          {tracks.map((t) => {
            const isActive = t.id === activeId;
            return (
              <li
                key={t.id}
                className={cn(
                  'px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors',
                  isActive ? 'bg-muted/30' : '',
                )}
              >
                <button
                  type="button"
                  onClick={() => void handleRowPlay(t.id)}
                  className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-muted/40 border border-border/60 flex items-center justify-center"
                  aria-label={isActive && isPlaying ? 'Pause' : 'Play'}
                >
                  {t.artworkUrl ? (
                    <ArtworkImage
                      src={t.artworkUrl}
                      alt={t.title}
                      className="h-10 w-10 object-cover"
                    />
                  ) : (
                    <span className="text-sm">{isActive && isPlaying ? '⏸' : '▶'}</span>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium truncate">{t.title}</p>
                    {isActive && (
                      <Badge variant="secondary" className="shrink-0">
                        {isPlaying ? 'Playing' : 'Paused'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{t.artistName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatCount(t.individualListenCount)} individual listens · {formatCount(t.likeCount)} likes
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-2 shrink-0 text-xs text-muted-foreground font-mono">
                  {t.durationSeconds ? formatTime(t.durationSeconds) : '—'}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant={t.liked ? 'default' : 'outline'}
                    size="sm"
                    disabled={!onToggleLike || isLikeBusy(t.id)}
                    onClick={() => void toggleLike(t)}
                  >
                    {isLikeBusy(t.id) ? '…' : t.liked ? 'Liked' : 'Like'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Inline controls when this discography is the active source (global Now Playing bar shows track everywhere) */}
      {isDiscographyActive && activeTrack && (
        <div className="mt-4 p-4 rounded-xl border border-border bg-muted/20 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" disabled={!canPrev} onClick={() => void playIndex(activeIndex - 1, true)} aria-label="Previous">
              ⏮
            </Button>
            <Button type="button" variant="default" size="icon" onClick={() => void togglePlay()} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? '⏸' : '▶'}
            </Button>
            <Button type="button" variant="ghost" size="icon" disabled={!canNext} onClick={() => void playIndex(activeIndex + 1, true)} aria-label="Next">
              ⏭
            </Button>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono flex-1 min-w-0">
            <span className="w-10 text-right shrink-0">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, duration || 0)}
              step={0.25}
              value={Math.min(currentTime, duration || 0)}
              onMouseDown={() => setSeeking(true)}
              onMouseUp={() => setSeeking(false)}
              onTouchStart={() => setSeeking(true)}
              onTouchEnd={() => setSeeking(false)}
              onChange={(e) => onSeekChange(Number(e.target.value))}
              className="w-full max-w-[200px]"
              aria-label="Seek"
            />
            <span className="w-10 shrink-0">{formatTime(duration || 0)}</span>
          </div>
          <div className="flex items-center gap-2 w-32">
            <span className="text-xs text-muted-foreground">🔊</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => actions.setVolume(Number(e.target.value))}
              className="w-full"
              aria-label="Volume"
            />
          </div>
        </div>
      )}
    </div>
  );
}

