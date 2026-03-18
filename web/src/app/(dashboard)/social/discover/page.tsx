'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  discoverAudioApi,
  discoveryApi,
  songsApi,
  type DiscoverAudioSongCard,
  type DiscoverFeedPost,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const PAGE_SIZE = 12;
const SWIPE_THRESHOLD_PX = 90;

export default function SocialDiscoverSwipePage() {
  const router = useRouter();
  const [cards, setCards] = useState<DiscoverAudioSongCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busySwipe, setBusySwipe] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [shownAt, setShownAt] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedPosts, setFeedPosts] = useState<DiscoverFeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySongs, setLibrarySongs] = useState<
    Array<{
      id: string;
      title: string;
      artistName: string;
      audioUrl: string;
      artworkUrl: string | null;
      status: string;
    }>
  >([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [selectedSongId, setSelectedSongId] = useState('');
  const [clipStartSeconds, setClipStartSeconds] = useState('0');
  const [clipEndSeconds, setClipEndSeconds] = useState('15');
  const [audioPositionSeconds, setAudioPositionSeconds] = useState(0);
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);

  const pointerStartX = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchingRef = useRef(false);
  const audioCapSecondsRef = useRef<number>(15);

  const currentCard = cards[0] ?? null;
  const currentCardClipCapSeconds = Math.max(
    1,
    Math.min(15, currentCard?.clipDurationSeconds || 15),
  );

  const loadFeed = useCallback(
    async (append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await discoverAudioApi.getFeed({
          limit: PAGE_SIZE,
          cursor: append ? nextCursor ?? undefined : undefined,
        });
        const data = res.data;
        if (append) {
          setCards((prev) => [...prev, ...data.items]);
        } else {
          setCards(data.items);
        }
        setNextCursor(data.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load discover feed');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [nextCursor],
  );

  useEffect(() => {
    void loadFeed(false);
  }, [loadFeed]);

  useEffect(() => {
    let alive = true;
    const loadSocialFeed = async () => {
      setFeedLoading(true);
      try {
        const res = await discoveryApi.listFeed({ limit: 6 });
        if (!alive) return;
        setFeedPosts(res.data.items ?? []);
      } catch {
        if (!alive) return;
        setFeedPosts([]);
      } finally {
        if (alive) setFeedLoading(false);
      }
    };
    void loadSocialFeed();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setShownAt(Date.now());
    setDragX(0);
    setDragging(false);
    setAudioPositionSeconds(0);
    setAudioIsPlaying(false);
  }, [currentCard?.songId]);

  useEffect(() => {
    const audio = audioRef.current;
    const card = currentCard;
    if (!audio || !card) return;
    const clipCap = Math.max(1, Math.min(15, card.clipDurationSeconds || 15));
    audioCapSecondsRef.current = clipCap;
    setAudioPositionSeconds(0);
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Browser autoplay policy may block without user gesture.
    });
    const stopTimer = window.setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      setAudioPositionSeconds(0);
    }, Math.max(1000, clipCap * 1000));
    return () => window.clearTimeout(stopTimer);
  }, [currentCard, currentCard?.songId, currentCard?.clipDurationSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const capPlaybackToClip = () => {
      const cap = audioCapSecondsRef.current;
      if (audio.currentTime > cap) {
        audio.currentTime = cap;
      }
      setAudioPositionSeconds(Math.min(audio.currentTime, cap));
    };

    const stopAtClipEnd = () => {
      const cap = audioCapSecondsRef.current;
      setAudioPositionSeconds(Math.min(audio.currentTime, cap));
      if (audio.currentTime >= cap) {
        audio.pause();
        audio.currentTime = 0;
        setAudioPositionSeconds(0);
      }
    };

    const onPlay = () => setAudioIsPlaying(true);
    const onPause = () => setAudioIsPlaying(false);

    audio.addEventListener('seeking', capPlaybackToClip);
    audio.addEventListener('timeupdate', stopAtClipEnd);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('seeking', capPlaybackToClip);
      audio.removeEventListener('timeupdate', stopAtClipEnd);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [currentCard?.songId]);

  const formatPlaybackClock = useCallback((seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const rem = safeSeconds % 60;
    return `${minutes}:${rem.toString().padStart(2, '0')}`;
  }, []);

  const toggleTopCardPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      return;
    }
    audio.pause();
  }, []);

  const seekTopCardPlayback = useCallback((nextSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const cap = audioCapSecondsRef.current;
    const bounded = Math.max(0, Math.min(cap, nextSeconds));
    audio.currentTime = bounded;
    setAudioPositionSeconds(bounded);
  }, []);

  const maybePrefetch = useCallback(async () => {
    if (prefetchingRef.current) return;
    if (cards.length > 3) return;
    if (!nextCursor) return;
    prefetchingRef.current = true;
    try {
      const res = await discoverAudioApi.getFeed({
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setCards((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.nextCursor);
    } finally {
      prefetchingRef.current = false;
    }
  }, [cards.length, nextCursor]);

  const applySwipe = useCallback(
    async (direction: 'left_skip' | 'right_like') => {
      if (!currentCard || busySwipe) return;
      setBusySwipe(true);
      const decisionMs = Math.max(0, Date.now() - shownAt);
      try {
        await discoverAudioApi.swipe({
          songId: currentCard.songId,
          direction,
          decisionMs,
        });
        setCards((prev) => prev.slice(1));
        setDragX(0);
        setDragging(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Swipe failed');
      } finally {
        setBusySwipe(false);
        void maybePrefetch();
      }
    },
    [busySwipe, currentCard, maybePrefetch, shownAt],
  );

  const loadLibrarySongs = useCallback(async () => {
    setLibraryLoading(true);
    setPublishError(null);
    try {
      const res = await songsApi.getMine();
      const rows = (res.data as unknown[]) ?? [];
      const songs = rows
        .map((row) => (row && typeof row === 'object' ? (row as Record<string, unknown>) : null))
        .filter((row): row is Record<string, unknown> => {
          const audioUrl = row?.audioUrl;
          return typeof audioUrl === 'string' && audioUrl.trim().length > 0;
        })
        .map((row) => ({
          id: typeof row.id === 'string' ? row.id : '',
          title: typeof row.title === 'string' ? row.title : 'Untitled',
          artistName:
            typeof row.artistName === 'string' ? row.artistName : 'Unknown artist',
          audioUrl: row.audioUrl as string,
          artworkUrl:
            typeof row.artworkUrl === 'string' ? row.artworkUrl : null,
          status: typeof row.status === 'string' ? row.status : 'pending',
        }))
        .filter((song) => song.id.length > 0);
      setLibrarySongs(songs);
      if (!selectedSongId && songs[0]?.id) {
        setSelectedSongId(songs[0].id);
      }
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Failed to load your library');
      setLibrarySongs([]);
    } finally {
      setLibraryLoading(false);
    }
  }, [selectedSongId]);

  useEffect(() => {
    if (!libraryOpen) return;
    void loadLibrarySongs();
  }, [libraryOpen, loadLibrarySongs]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!currentCard || busySwipe) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void applySwipe('left_skip');
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        void applySwipe('right_like');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applySwipe, busySwipe, currentCard]);

  const dragStyle = useMemo(
    () => ({
      transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)`,
      transition: dragging ? 'none' : 'transform 180ms ease',
    }),
    [dragX, dragging],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!currentCard || busySwipe) return;
    pointerIdRef.current = event.pointerId;
    pointerStartX.current = event.clientX;
    setDragging(true);
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || pointerStartX.current == null) return;
    if (pointerIdRef.current !== event.pointerId) return;
    setDragX(event.clientX - pointerStartX.current);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragX >= SWIPE_THRESHOLD_PX) {
      void applySwipe('right_like');
      return;
    }
    if (dragX <= -SWIPE_THRESHOLD_PX) {
      void applySwipe('left_skip');
      return;
    }
    setDragX(0);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Discover</h1>
          <p className="text-sm text-muted-foreground">
            Swipe right to like, left to skip. Clip playback is capped at 15 seconds.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/social">Back to Social</Link>
          </Button>
          <Dialog
            open={libraryOpen}
            onOpenChange={(open) => {
              setLibraryOpen(open);
              if (!open) setPublishError(null);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">Upload from library</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish Discover Clip</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choose a song from your saved library and trim a 15-second Discover clip.
                </p>
                {libraryLoading ? (
                  <p className="text-sm text-muted-foreground">Loading your library...</p>
                ) : librarySongs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No songs in your library yet. Upload a song first, then come back.
                  </p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="library-song">Song</Label>
                      <select
                        id="library-song"
                        value={selectedSongId}
                        onChange={(e) => setSelectedSongId(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {librarySongs.map((song) => (
                          <option key={song.id} value={song.id}>
                            {song.title} - {song.artistName} ({song.status})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="clip-start">Clip start (seconds)</Label>
                        <Input
                          id="clip-start"
                          type="number"
                          min="0"
                          step="0.1"
                          value={clipStartSeconds}
                          onChange={(e) => setClipStartSeconds(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="clip-end">Clip end (seconds)</Label>
                        <Input
                          id="clip-end"
                          type="number"
                          min="0"
                          step="0.1"
                          value={clipEndSeconds}
                          onChange={(e) => setClipEndSeconds(e.target.value)}
                        />
                      </div>
                    </div>
                    {publishError && (
                      <p className="text-sm text-destructive">{publishError}</p>
                    )}
                    <Button
                      disabled={publishBusy || !selectedSongId}
                      onClick={async () => {
                        const start = Number(clipStartSeconds);
                        const end = Number(clipEndSeconds);
                        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
                          setPublishError('Clip start/end must be valid and end > start.');
                          return;
                        }
                        if (end - start > 15) {
                          setPublishError('Clip range must be 15 seconds or less.');
                          return;
                        }
                        setPublishBusy(true);
                        setPublishError(null);
                        try {
                          await songsApi.publishDiscoverFromLibrary(selectedSongId, {
                            clipStartSeconds: start,
                            clipEndSeconds: end,
                          });
                          setLibraryOpen(false);
                          setClipStartSeconds('0');
                          setClipEndSeconds('15');
                          await loadFeed(false);
                        } catch (e) {
                          const apiMessage =
                            (e as { response?: { data?: { message?: string | string[] } } })
                              ?.response?.data?.message;
                          const normalizedApiMessage = Array.isArray(apiMessage)
                            ? apiMessage.join(', ')
                            : apiMessage;
                          setPublishError(
                            normalizedApiMessage ||
                              (e instanceof Error
                                ? e.message
                                : 'Failed to publish discover clip'),
                          );
                        } finally {
                          setPublishBusy(false);
                        }
                      }}
                    >
                      {publishBusy ? 'Publishing...' : 'Publish to Discover'}
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button asChild>
            <Link href="/social/discover/list">Discover list</Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : !currentCard ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <p className="text-muted-foreground">
              No more clips right now. Check your Discover list or refresh for new drops.
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => void loadFeed(false)}>Refresh feed</Button>
              <Button variant="outline" asChild>
                <Link href="/social/discover/list">Open Discover list</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="relative h-[520px] sm:h-[560px]">
            {cards.slice(0, 3).reverse().map((card, reversedIndex) => {
              const actualIndex = cards.slice(0, 3).length - 1 - reversedIndex;
              const isTop = actualIndex === 0;
              const layerOffset = (cards.slice(0, 3).length - 1 - actualIndex) * 8;
              return (
                <div
                  key={card.songId}
                  className="absolute inset-0"
                  style={{
                    zIndex: isTop ? 20 : 10 - actualIndex,
                    transform: isTop
                      ? undefined
                      : `translateY(${layerOffset}px) scale(${1 - layerOffset / 300})`,
                  }}
                >
                  <Card
                    className="h-full overflow-hidden border-border/80"
                    style={isTop ? dragStyle : undefined}
                    onPointerDown={isTop ? onPointerDown : undefined}
                    onPointerMove={isTop ? onPointerMove : undefined}
                    onPointerUp={isTop ? onPointerUp : undefined}
                    onPointerCancel={isTop ? onPointerUp : undefined}
                  >
                    <CardContent className="p-0 h-full">
                      <div className="relative h-full">
                        {card.backgroundUrl ? (
                          <Image
                            src={card.backgroundUrl}
                            alt={card.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 720px"
                            unoptimized={card.backgroundUrl.includes('supabase')}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-black/40 to-black/70" />
                        )}
                        <div className="absolute inset-0 bg-black/45" />
                        <div className="absolute inset-0 p-5 flex flex-col justify-between">
                          <div className="flex justify-between items-start gap-3">
                            <button
                              type="button"
                              className="rounded-full bg-black/55 px-3 py-1 text-xs text-white hover:bg-black/70"
                              onClick={() => void applySwipe('right_like')}
                              disabled={busySwipe || !isTop}
                            >
                              Save
                            </button>
                            <div className="rounded-full bg-black/55 px-3 py-1 text-xs text-white">
                              {card.clipDurationSeconds}s clip
                            </div>
                            <div className="rounded-full bg-black/55 px-3 py-1 text-xs text-white">
                              {card.likeCount} likes
                            </div>
                          </div>

                          <div className="space-y-3 text-white">
                            <div className="flex items-center gap-3">
                              {card.artistAvatarUrl ? (
                                <Image
                                  src={card.artistAvatarUrl}
                                  alt={card.artistDisplayName ?? card.artistName}
                                  width={44}
                                  height={44}
                                  className="rounded-full object-cover"
                                  unoptimized={card.artistAvatarUrl.includes('supabase')}
                                />
                              ) : (
                                <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center text-lg">
                                  🎤
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold truncate">
                                  {card.artistDisplayName ?? card.artistName}
                                </p>
                                <p className="text-xs text-white/80 truncate">
                                  {card.artistHeadline ?? 'Artist'}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="text-2xl font-semibold">{card.title}</p>
                              <p className="text-sm text-white/80">{card.artistName}</p>
                            </div>

                            {isTop ? (
                              <div className="rounded-lg bg-black/55 p-3 space-y-2">
                                <audio
                                  ref={audioRef}
                                  key={card.songId}
                                  src={card.clipUrl}
                                  preload="metadata"
                                  className="hidden"
                                />
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={toggleTopCardPlayback}
                                    className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-medium text-black hover:bg-cyan-300"
                                  >
                                    {audioIsPlaying ? 'Pause' : 'Play'}
                                  </button>
                                  <input
                                    type="range"
                                    min={0}
                                    max={currentCardClipCapSeconds}
                                    step={0.1}
                                    value={Math.min(
                                      audioPositionSeconds,
                                      currentCardClipCapSeconds,
                                    )}
                                    onChange={(event) =>
                                      seekTopCardPlayback(Number(event.target.value))
                                    }
                                    className="w-full accent-cyan-400"
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-white/80">
                                  <span>{formatPlaybackClock(audioPositionSeconds)}</span>
                                  <span>
                                    {formatPlaybackClock(currentCardClipCapSeconds)}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              disabled={busySwipe || !currentCard}
              onClick={() => void applySwipe('left_skip')}
            >
              Skip Left
            </Button>
            <Button disabled={busySwipe || !currentCard} onClick={() => void applySwipe('right_like')}>
              Like Right
            </Button>
          </div>
          {loadingMore && (
            <p className="text-center text-sm text-muted-foreground">Loading more clips…</p>
          )}
        </div>
      )}
      <Card className="border-border/80">
        <CardContent className="pt-4 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Search</h2>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchQuery.trim();
              if (!q) {
                router.push('/discover?tab=artist');
                return;
              }
              router.push(`/discover?tab=artist&q=${encodeURIComponent(q)}`);
            }}
          >
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artists or catalysts..."
            />
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Scroll Feed</h2>
            <Button asChild variant="outline">
              <Link href="/discover?tab=feed">Open full feed</Link>
            </Button>
          </div>
          {feedLoading ? (
            <p className="text-sm text-muted-foreground">Loading feed...</p>
          ) : feedPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No feed posts yet. Upload from the Discover feed to start posting.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {feedPosts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-lg border border-border/70 bg-card/50 p-3"
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {post.authorDisplayName ?? 'Creator'}
                  </p>
                  {post.caption ? (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {post.caption}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

