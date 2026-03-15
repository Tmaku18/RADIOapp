'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { discoverAudioApi, type DiscoverAudioSongCard } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const PAGE_SIZE = 12;
const SWIPE_THRESHOLD_PX = 90;

export default function SocialDiscoverSwipePage() {
  const [cards, setCards] = useState<DiscoverAudioSongCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busySwipe, setBusySwipe] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [shownAt, setShownAt] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);

  const pointerStartX = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchingRef = useRef(false);

  const currentCard = cards[0] ?? null;

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
    setShownAt(Date.now());
    setDragX(0);
    setDragging(false);
  }, [currentCard?.songId]);

  useEffect(() => {
    const audio = audioRef.current;
    const card = currentCard;
    if (!audio || !card) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Browser autoplay policy may block without user gesture.
    });
    const stopTimer = window.setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, Math.max(1000, card.clipDurationSeconds * 1000));
    return () => window.clearTimeout(stopTimer);
  }, [currentCard, currentCard?.songId, currentCard?.clipDurationSeconds]);

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

                            <audio
                              ref={isTop ? audioRef : undefined}
                              key={card.songId}
                              src={card.clipUrl}
                              controls
                              preload="metadata"
                              className="w-full"
                            />
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
    </div>
  );
}

