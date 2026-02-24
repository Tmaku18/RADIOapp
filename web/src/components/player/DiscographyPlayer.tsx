'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DiscographyTrack = {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  audioUrl: string | null;
  artworkUrl: string | null;
  durationSeconds?: number | null;
  likeCount?: number | null;
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

type Props = {
  tracks: DiscographyTrack[];
  onToggleLike?: (trackId: string, nextLiked: boolean) => Promise<void> | void;
  onRecordListen?: (trackId: string) => Promise<void> | void;
};

export function DiscographyPlayer({ tracks, onToggleLike, onRecordListen }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [seeking, setSeeking] = useState(false);

  // 30-second listen tracking (per play start)
  const listenStartAtRef = useRef<number | null>(null);
  const recordedForPlayRef = useRef<{ trackId: string; startedAtMs: number } | null>(null);

  const activeIndex = useMemo(() => tracks.findIndex((t) => t.id === activeId), [tracks, activeId]);
  const activeTrack = useMemo(() => (activeIndex >= 0 ? tracks[activeIndex] : null), [tracks, activeIndex]);

  const canPrev = activeIndex > 0;
  const canNext = activeIndex >= 0 && activeIndex < tracks.length - 1;

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const el = typeof document !== 'undefined' ? document.createElement('audio') : null;
    if (!el) return null;
    el.preload = 'metadata';
    audioRef.current = el;
    return el;
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!seeking) {
      setCurrentTime(a.currentTime || 0);
      setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    }

    // Record listen when crossing 30s of listened time for this play start.
    if (activeId && onRecordListen && listenStartAtRef.current != null) {
      const startedAtMs = listenStartAtRef.current;
      const already = recordedForPlayRef.current;
      const isSamePlay = already && already.trackId === activeId && already.startedAtMs === startedAtMs;
      if (!isSamePlay && (a.currentTime || 0) >= 30) {
        recordedForPlayRef.current = { trackId: activeId, startedAtMs };
        void onRecordListen(activeId);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [activeId, onRecordListen, seeking]);

  const setMediaSession = useCallback(
    (t: DiscographyTrack | null) => {
      if (typeof navigator === 'undefined') return;
      const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
      if (!ms) return;
      try {
        if (!t) {
          ms.metadata = null;
          return;
        }
        ms.metadata = new MediaMetadata({
          title: t.title,
          artist: t.artistName,
          album: 'NETWORX',
          artwork: t.artworkUrl
            ? [
                { src: t.artworkUrl, sizes: '96x96', type: 'image/png' },
                { src: t.artworkUrl, sizes: '192x192', type: 'image/png' },
                { src: t.artworkUrl, sizes: '512x512', type: 'image/png' },
              ]
            : [],
        });

        ms.setActionHandler('play', async () => {
          await audioRef.current?.play();
        });
        ms.setActionHandler('pause', () => {
          audioRef.current?.pause();
        });
        ms.setActionHandler('previoustrack', () => {
          if (canPrev) void playIndex(activeIndex - 1, true);
        });
        ms.setActionHandler('nexttrack', () => {
          if (canNext) void playIndex(activeIndex + 1, true);
        });
        ms.setActionHandler('seekto', (event) => {
          const a = audioRef.current;
          if (!a) return;
          const to = typeof event?.seekTime === 'number' ? event.seekTime : 0;
          a.currentTime = clamp(to, 0, Number.isFinite(a.duration) ? a.duration : to);
        });
      } catch {
        // Best-effort only.
      }
    },
    [activeIndex, canNext, canPrev],
  );

  const attachAudioEvents = useCallback((a: HTMLAudioElement) => {
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      if (canNext) void playIndex(activeIndex + 1, true);
    };
    const onLoaded = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);

    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    a.addEventListener('loadedmetadata', onLoaded);

    return () => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [activeIndex, canNext]);

  const playIndex = useCallback(
    async (index: number, autoPlay = false) => {
      const t = tracks[index];
      if (!t) return;
      if (!t.audioUrl) return;

      const a = ensureAudio();
      if (!a) return;

      // New play start
      listenStartAtRef.current = Date.now();
      recordedForPlayRef.current = null;

      a.src = t.audioUrl;
      a.volume = volume;
      setActiveId(t.id);
      setCurrentTime(0);
      setDuration(t.durationSeconds ? t.durationSeconds : 0);
      setMediaSession(t);

      try {
        if (autoPlay) {
          await a.play();
        }
      } catch {
        // Autoplay may be blocked; user can press play.
      }
    },
    [ensureAudio, setMediaSession, tracks, volume],
  );

  const togglePlay = useCallback(async () => {
    const a = ensureAudio();
    if (!a) return;

    if (!activeTrack) {
      // Start at top of list
      const idx = tracks.findIndex((t) => !!t.audioUrl);
      if (idx >= 0) await playIndex(idx, true);
      return;
    }

    if (a.paused) {
      try {
        await a.play();
      } catch {
        // ignored
      }
    } else {
      a.pause();
    }
  }, [activeTrack, ensureAudio, playIndex, tracks]);

  const handleRowPlay = useCallback(
    async (trackId: string) => {
      const idx = tracks.findIndex((t) => t.id === trackId);
      if (idx < 0) return;

      if (activeId === trackId && isPlaying) {
        audioRef.current?.pause();
        return;
      }
      if (activeId === trackId && !isPlaying) {
        await togglePlay();
        return;
      }

      await playIndex(idx, true);
    },
    [activeId, isPlaying, playIndex, togglePlay, tracks],
  );

  // Init audio element + events once
  useEffect(() => {
    const a = ensureAudio();
    if (!a) return;
    const detach = attachAudioEvents(a);
    a.volume = volume;

    stopRaf();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      detach();
      stopRaf();
      a.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Update media session playback state
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
    if (!ms) return;
    try {
      ms.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {
      // ignore
    }
  }, [isPlaying]);

  const onSeekChange = useCallback(
    (value: number) => {
      const a = audioRef.current;
      if (!a) return;
      setCurrentTime(value);
      a.currentTime = clamp(value, 0, Number.isFinite(a.duration) ? a.duration : value);
    },
    [],
  );

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
                    <Image src={t.artworkUrl} alt="" width={40} height={40} className="object-cover" />
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

      {/* Sticky player bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/40 border border-border/60 shrink-0">
              {activeTrack?.artworkUrl ? (
                <Image src={activeTrack.artworkUrl} alt="" width={48} height={48} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">♪</div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{activeTrack?.title ?? 'Select a track'}</p>
              <p className="text-xs text-muted-foreground truncate">{activeTrack?.artistName ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" disabled={!canPrev} onClick={() => void playIndex(activeIndex - 1, true)}>
              ⏮
            </Button>
            <Button type="button" variant="default" size="icon" onClick={() => void togglePlay()}>
              {isPlaying ? '⏸' : '▶'}
            </Button>
            <Button type="button" variant="ghost" size="icon" disabled={!canNext} onClick={() => void playIndex(activeIndex + 1, true)}>
              ⏭
            </Button>
          </div>

          <div className="hidden md:flex flex-col gap-1 w-[420px] max-w-[40vw]">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
              <span className="w-10 text-right">{formatTime(currentTime)}</span>
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
                className="w-full"
                aria-label="Seek"
                disabled={!activeTrack}
              />
              <span className="w-10">{formatTime(duration || 0)}</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 w-40">
            <span className="text-xs text-muted-foreground">🔊</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>

      {/* Spacer so content doesn't hide behind the bar */}
      <div className="h-24" />
    </div>
  );
}

