'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { songsApi } from '@/lib/api';
import { artistProfilePath } from '@/lib/artist-links';
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
                  <div className="min-w-0">
                    <p className="truncate font-medium">{song.title}</p>
                    <Link
                      href={artistProfilePath(song.artistId)}
                      className="truncate text-sm text-muted-foreground hover:underline"
                    >
                      {song.artistName}
                    </Link>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground flex items-center gap-3">
                    <span>♥ {song.likeCount}</span>
                    <span>▶ {song.playCount}</span>
                    <span>🌡 {song.temperaturePercent}%</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
