'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { discoverAudioApi, type DiscoverAudioSongCard } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DiscoverLikedItem = DiscoverAudioSongCard & { likedAt: string };

export default function DiscoverListPage() {
  const [items, setItems] = useState<DiscoverLikedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await discoverAudioApi.getLikedList({ limit: 100, offset: 0 });
      setItems(res.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Discover list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Discover list</h1>
          <p className="text-sm text-muted-foreground">
            Tracks you liked while swiping in Discover.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/social">Back to Social</Link>
          </Button>
          <Button asChild>
            <Link href="/social/discover">Open Discover swipe</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : error ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => void load()}>Retry</Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <p className="text-muted-foreground">
              Your Discover list is empty. Swipe right on tracks to add them.
            </p>
            <Button asChild>
              <Link href="/social/discover">Start swiping</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Song</TableHead>
                <TableHead>Artist</TableHead>
                <TableHead>Liked on</TableHead>
                <TableHead>Clip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.songId}>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-0">
                      {item.backgroundUrl ? (
                        <Image
                          src={item.backgroundUrl}
                          alt={item.title}
                          width={44}
                          height={44}
                          className="h-11 w-11 rounded object-cover"
                          unoptimized={item.backgroundUrl.includes('supabase')}
                        />
                      ) : (
                        <div className="h-11 w-11 rounded bg-muted flex items-center justify-center">🎵</div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.likeCount} likes</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate">{item.artistDisplayName ?? item.artistName}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.artistHeadline ?? 'Artist'}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(item.likedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </TableCell>
                  <TableCell className="min-w-[260px]">
                    <audio controls preload="metadata" src={item.clipUrl} className="w-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

