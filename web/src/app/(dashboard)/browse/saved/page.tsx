'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { songsApi } from '@/lib/api';
import { usePlayback } from '@/components/playback';
import { artistProfilePath } from '@/lib/artist-links';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArtworkImage } from '@/components/common/ArtworkImage';

type LibrarySong = {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  audioUrl: string | null;
  durationSeconds: number;
  likeCount: number;
  playCount: number;
  fireVotes: number;
  shitVotes: number;
  temperaturePercent: number;
  likedAt: string;
};

type PurchasedSong = {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  durationSeconds: number;
  likeCount: number;
  playCount: number;
  purchasedAt: string;
  amountCents: number;
  currency: string;
};

export default function BrowseSavedPage() {
  const searchParams = useSearchParams();
  const { actions } = usePlayback();
  const [tab, setTab] = useState<'liked' | 'music'>(
    searchParams.get('tab') === 'music' ? 'music' : 'liked',
  );
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<LibrarySong[]>([]);
  const [purchases, setPurchases] = useState<PurchasedSong[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [pendingRemove, setPendingRemove] = useState<LibrarySong | null>(null);
  const [removing, setRemoving] = useState(false);
  const [sortBy, setSortBy] = useState<
    'recent' | 'oldest' | 'artist' | 'title' | 'likes' | 'plays' | 'temperature'
  >('recent');

  useEffect(() => {
    if (searchParams.get('purchase') === 'success') {
      toast.success('Purchase complete! Your song is in My Music.');
      setTab('music');
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await songsApi.getLibrary();
        if (!cancelled) {
          setSongs((res.data ?? []) as LibrarySong[]);
        }
      } catch {
        if (!cancelled) {
          setSongs([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPurchasesLoading(true);
      try {
        const res = await songsApi.getPurchases();
        if (!cancelled) {
          setPurchases((res.data ?? []) as PurchasedSong[]);
        }
      } catch {
        if (!cancelled) setPurchases([]);
      } finally {
        if (!cancelled) setPurchasesLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const playPurchased = async (song: PurchasedSong) => {
    try {
      const res = await songsApi.getStreamUrl(song.id);
      const url = res.data?.url;
      if (!url) return;
      actions.loadTrack(
        {
          id: song.id,
          title: song.title,
          artistName: song.artistName,
          artistId: song.artistId,
          artworkUrl: song.artworkUrl,
          audioUrl: url,
          durationSeconds: song.durationSeconds,
        },
        'discography',
      );
      await actions.play();
    } catch {
      toast.error('Could not play this song.');
    }
  };

  const downloadPurchased = async (song: PurchasedSong) => {
    try {
      const res = await songsApi.getDownloadUrl(song.id);
      const url = res.data?.url;
      if (url) window.open(url, '_blank', 'noopener');
    } catch {
      toast.error('Could not download this song.');
    }
  };

  const sortedSongs = useMemo(() => {
    const list = [...songs];
    list.sort((a, b) => {
      if (sortBy === 'recent') return (b.likedAt ?? '').localeCompare(a.likedAt ?? '');
      if (sortBy === 'oldest') return (a.likedAt ?? '').localeCompare(b.likedAt ?? '');
      if (sortBy === 'artist') return a.artistName.localeCompare(b.artistName);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'temperature') return b.temperaturePercent - a.temperaturePercent;
      if (sortBy === 'plays') return b.playCount - a.playCount;
      return b.likeCount - a.likeCount;
    });
    return list;
  }, [songs, sortBy]);

  async function confirmRemoveFromLibrary() {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await songsApi.unlike(pendingRemove.id);
      setSongs((prev) => prev.filter((s) => s.id !== pendingRemove.id));
      toast.success('Removed from your library');
      setPendingRemove(null);
    } catch {
      toast.error('Could not remove that song. Try again.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your Library</h1>
        {tab === 'liked' && (
        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(
              e.target.value as
                | 'recent'
                | 'oldest'
                | 'artist'
                | 'title'
                | 'likes'
                | 'plays'
                | 'temperature',
            )
          }
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="recent">Recently added</option>
          <option value="oldest">Oldest added</option>
          <option value="artist">Artist</option>
          <option value="title">Song title</option>
          <option value="likes">Likes</option>
          <option value="plays">Plays</option>
          <option value="temperature">Temperature</option>
        </select>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('liked')}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            tab === 'liked'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Liked
        </button>
        <button
          type="button"
          onClick={() => setTab('music')}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            tab === 'music'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          My Music{purchases.length > 0 ? ` (${purchases.length})` : ''}
        </button>
      </div>

      {tab === 'music' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Purchased Music</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {purchasesLoading ? (
              <p className="text-sm text-muted-foreground">Loading your music…</p>
            ) : purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You haven&apos;t bought any songs yet. Buy a song from an
                artist&apos;s page to play the full track and download it here.
              </p>
            ) : (
              purchases.map((song) => (
                <div
                  key={song.id}
                  className="rounded-lg border border-border/70 bg-card px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <ArtworkImage
                        src={song.artworkUrl}
                        alt={`${song.title} album cover`}
                        className="h-11 w-11 shrink-0 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{song.title}</p>
                        <Link
                          href={artistProfilePath(song.artistId)}
                          className="block truncate text-sm text-muted-foreground hover:underline"
                        >
                          {song.artistName}
                        </Link>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => void playPurchased(song)}
                      >
                        Play
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8"
                        onClick={() => void downloadPurchased(song)}
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liked Songs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading library...</p>
          ) : sortedSongs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No liked songs yet. Tap the heart on a song in radio to add it
              here. Liked songs play a 30-second sample — buy a song to own the
              full track.
            </p>
          ) : (
            sortedSongs.map((song) => (
              <div
                key={song.id}
                className="rounded-lg border border-border/70 bg-card px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <ArtworkImage
                      src={song.artworkUrl}
                      alt={`${song.title} album cover`}
                      className="h-11 w-11 shrink-0 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{song.title}</p>
                      <Link
                        href={artistProfilePath(song.artistId)}
                        className="block truncate text-sm text-muted-foreground hover:underline"
                      >
                        {song.artistName}
                      </Link>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-2 sm:gap-3">
                      <span title="Likes">♥ {song.likeCount}</span>
                      <span title="Plays">▶ {song.playCount}</span>
                      <span title="Temperature">🌡 {song.temperaturePercent}%</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingRemove(song)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      )}

      <AlertDialog
        open={pendingRemove != null}
        onOpenChange={(open) => {
          if (!open && !removing) setPendingRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from your library?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your save for{' '}
              <span className="font-medium text-foreground">
                {pendingRemove?.title}
              </span>
              . You can add it again from the radio player anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={removing}
              onClick={() => void confirmRemoveFromLibrary()}
            >
              {removing ? 'Removing…' : 'Remove'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
