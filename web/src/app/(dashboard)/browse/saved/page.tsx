'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { songsApi } from '@/lib/api';
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

export default function BrowseSavedPage() {
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<LibrarySong[]>([]);
  const [pendingRemove, setPendingRemove] = useState<LibrarySong | null>(null);
  const [removing, setRemoving] = useState(false);
  const [sortBy, setSortBy] = useState<
    'artist' | 'title' | 'likes' | 'plays' | 'temperature'
  >('likes');

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

  const sortedSongs = useMemo(() => {
    const list = [...songs];
    list.sort((a, b) => {
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
        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(
              e.target.value as
                | 'artist'
                | 'title'
                | 'likes'
                | 'plays'
                | 'temperature',
            )
          }
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="artist">Artist</option>
          <option value="title">Song title</option>
          <option value="likes">Likes</option>
          <option value="plays">Plays</option>
          <option value="temperature">Temperature</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved Songs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading library...</p>
          ) : sortedSongs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No songs saved yet. Tap save on a song in radio to add it here.
            </p>
          ) : (
            sortedSongs.map((song) => (
              <div
                key={song.id}
                className="rounded-lg border border-border/70 bg-card px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{song.title}</p>
                    <Link
                      href={artistProfilePath(song.artistId)}
                      className="truncate text-sm text-muted-foreground hover:underline"
                    >
                      {song.artistName}
                    </Link>
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
