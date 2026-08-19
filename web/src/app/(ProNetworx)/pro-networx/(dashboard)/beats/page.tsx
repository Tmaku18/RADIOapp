'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Pause, Play, Plus, Search as SearchIcon } from 'lucide-react';
import {
  songSalesApi,
  songsApi,
  type MarketplaceBeat,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasArtistCapability } from '@/lib/roles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const PAGE_SIZE = 60;

function shouldUnoptimize(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

function formatPrice(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const rem = Math.floor(seconds % 60);
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export default function ProNetworxBeatsPage() {
  const { user, profile } = useAuth();
  const canUpload = hasArtistCapability(profile?.role) || profile?.role === 'service_provider';
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [items, setItems] = useState<MarketplaceBeat[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchPage = useCallback(
    async (append: boolean, currentOffset: number) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await songsApi.listMarketplaceBeats({
          q: appliedQuery.trim() || undefined,
          limit: PAGE_SIZE,
          offset: currentOffset,
        });
        const next = Array.isArray(res.data) ? res.data : [];
        setItems((prev) => (append ? [...prev, ...next] : next));
        setHasMore(next.length === PAGE_SIZE);
      } catch (e) {
        console.error('Failed to load beats:', e);
        if (!append) setItems([]);
        setError('Could not load the beat marketplace.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [appliedQuery],
  );

  useEffect(() => {
    setOffset(0);
    void fetchPage(false, 0);
  }, [fetchPage]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const playBeat = async (beat: MarketplaceBeat) => {
    if (playingId === beat.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    let url = beat.previewUrl?.trim() || '';
    if (!url) {
      try {
        const res = await songsApi.getStreamUrl(beat.id);
        url = res.data?.url ?? '';
      } catch {
        setError('Could not start a full preview for this beat.');
        return;
      }
    }
    if (!url) {
      setError('No preview is available for this beat yet.');
      return;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener('ended', () => {
      setPlayingId(null);
      audioRef.current = null;
    });
    try {
      await audio.play();
      setPlayingId(beat.id);
      setError(null);
    } catch {
      setError('Browser blocked playback. Tap Play again.');
    }
  };

  const buyBeat = async (beat: MarketplaceBeat) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setBuyingId(beat.id);
    try {
      const res = await songSalesApi.buySong(beat.id, {
        successUrl: `${window.location.origin}/pro-networx/beats?purchased=${encodeURIComponent(beat.id)}`,
        cancelUrl: `${window.location.origin}/pro-networx/beats`,
      });
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      setError('Could not start checkout. Try again.');
    } catch (e) {
      const serverMessage = (
        e as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      setError(
        typeof serverMessage === 'string' && serverMessage.trim()
          ? serverMessage
          : 'Could not start checkout. Try again.',
      );
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Beat Marketplace</h1>
          <p className="text-sm text-muted-foreground">
            Browse beats for sale. Full listen-before-buy — not a 30-second sample.
          </p>
        </div>
        {canUpload && (
          <Button asChild>
            <Link href="/artist/upload?kind=beat" className="inline-flex items-center gap-1">
              <Plus className="h-4 w-4" /> Upload a beat for sale
            </Link>
          </Button>
        )}
      </div>

      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedQuery(query);
        }}
      >
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search beats or producers"
          className="pl-9"
        />
      </form>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          No beats are listed yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((beat) => (
            <Card key={beat.id} className="p-4 flex flex-col sm:flex-row gap-4">
              {beat.artworkUrl ? (
                <Image
                  src={beat.artworkUrl}
                  alt=""
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-md object-cover shrink-0"
                  unoptimized={shouldUnoptimize(beat.artworkUrl)}
                />
              ) : (
                <div className="h-[72px] w-[72px] rounded-md bg-muted shrink-0" />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Beat for sale · Full preview
                </p>
                <h2 className="font-semibold text-foreground truncate">{beat.title}</h2>
                <Link
                  href={`/pro-networx/u/${beat.artistId}`}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  {beat.artistName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(beat.priceCents)}
                  {formatDuration(beat.durationSeconds)
                    ? ` · ${formatDuration(beat.durationSeconds)}`
                    : ''}
                  {beat.listenCount > 0 ? ` · ${beat.listenCount} listens` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void playBeat(beat)}
                >
                  {playingId === beat.id ? (
                    <>
                      <Pause className="h-4 w-4 mr-1" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" /> Play full beat
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={buyingId === beat.id}
                  onClick={() => void buyBeat(beat)}
                >
                  {buyingId === beat.id ? 'Starting…' : `Buy ${formatPrice(beat.priceCents)}`}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              const next = offset + PAGE_SIZE;
              setOffset(next);
              void fetchPage(true, next);
            }}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
