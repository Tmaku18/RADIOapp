'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  discoverAudioApi,
  discoveryApi,
  songsApi,
  type DiscoverAudioSongCard,
  type LibrarySong,
} from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DiscoverLikedItem = DiscoverAudioSongCard & { likedAt: string };

type LikedArtist = {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  headline: string | null;
  likedSongCount: number;
  lastLikedAt: string | null;
};

type PeopleResult = {
  userId?: string;
  id?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  headline?: string | null;
};

function shouldUnoptimize(url?: string | null): boolean {
  return !!url && (url.includes('supabase') || /^https?:\/\//i.test(url));
}

export default function DiscoverLibraryPage() {
  const [tab, setTab] = useState('liked');
  const [liked, setLiked] = useState<DiscoverLikedItem[]>([]);
  const [favorites, setFavorites] = useState<LibrarySong[]>([]);
  const [disliked, setDisliked] = useState<DiscoverLikedItem[]>([]);
  const [purchases, setPurchases] = useState<
    Array<{
      id: string;
      title: string;
      artistName: string;
      artistId: string;
      artworkUrl: string | null;
      purchasedAt: string;
    }>
  >([]);
  const [artists, setArtists] = useState<LikedArtist[]>([]);
  const [artistSearch, setArtistSearch] = useState('');
  const [artistResults, setArtistResults] = useState<PeopleResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [removingSongId, setRemovingSongId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleClipPlay = useCallback((el: HTMLAudioElement) => {
    if (currentAudioRef.current && currentAudioRef.current !== el) {
      currentAudioRef.current.pause();
    }
    currentAudioRef.current = el;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [likedRes, favRes, skipRes, purchaseRes, artistsRes] = await Promise.all([
        discoverAudioApi.getLikedList({ limit: 100, offset: 0 }),
        songsApi.getFavorites().catch(() => ({ data: [] as LibrarySong[] })),
        discoverAudioApi.getHistory({ direction: 'left_skip', limit: 100, offset: 0 }),
        songsApi.getPurchases().catch(() => ({ data: [] })),
        discoverAudioApi.getLikedArtists({ limit: 100, offset: 0 }),
      ]);
      setLiked(likedRes.data.items);
      setFavorites(favRes.data ?? []);
      setDisliked(skipRes.data.items);
      setPurchases(purchaseRes.data ?? []);
      setArtists(artistsRes.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRemoveLiked = useCallback(async (songId: string) => {
    setRemovingSongId(songId);
    try {
      await discoverAudioApi.removeLikedSong(songId);
      setLiked((prev) => prev.filter((item) => item.songId !== songId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove song');
    } finally {
      setRemovingSongId((current) => (current === songId ? null : current));
    }
  }, []);

  const handleRemoveSwipe = useCallback(async (songId: string) => {
    setRemovingSongId(songId);
    try {
      await discoverAudioApi.removeSwipe(songId);
      setDisliked((prev) => prev.filter((item) => item.songId !== songId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove swipe');
    } finally {
      setRemovingSongId((current) => (current === songId ? null : current));
    }
  }, []);

  const handleRemoveFavorite = useCallback(async (songId: string) => {
    setRemovingSongId(songId);
    try {
      await songsApi.removeFavorite(songId);
      setFavorites((prev) => prev.filter((item) => item.id !== songId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove favorite');
    } finally {
      setRemovingSongId((current) => (current === songId ? null : current));
    }
  }, []);

  const handleClearLiked = useCallback(async () => {
    if (!liked.length) return;
    if (!window.confirm(`Clear all ${liked.length} liked tracks?`)) return;
    setClearing(true);
    try {
      await discoverAudioApi.clearLikedList();
      setLiked([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear Discover list');
    } finally {
      setClearing(false);
    }
  }, [liked.length]);

  const handleDownload = useCallback(async (songId: string) => {
    setDownloadingId(songId);
    try {
      const res = await songsApi.getDownloadUrl(songId);
      if (res.data?.url) window.open(res.data.url, '_blank', 'noopener');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download requires a purchase');
    } finally {
      setDownloadingId((current) => (current === songId ? null : current));
    }
  }, []);

  const searchArtists = useCallback(async () => {
    const q = artistSearch.trim();
    if (!q) {
      setArtistResults([]);
      return;
    }
    try {
      const res = await discoveryApi.listPeople({
        role: 'artist',
        search: q,
        limit: 20,
        offset: 0,
      });
      const data = res.data as { items?: PeopleResult[] };
      setArtistResults(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Artist search failed');
    }
  }, [artistSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Discover library</h1>
          <p className="text-sm text-muted-foreground">
            Liked clips, favorites, skips, purchases, and artists you liked.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/social">Back to Feed</Link>
          </Button>
          <Button asChild>
            <Link href="/social/discover">Open Discover swipe</Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => void load()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="liked">Liked</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="disliked">Disliked</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="artists">Artists</TabsTrigger>
        </TabsList>

        <TabsContent value="liked" className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => void handleClearLiked()}
              disabled={clearing || loading || liked.length === 0}
            >
              {clearing ? 'Clearing...' : 'Clear list'}
            </Button>
          </div>
          {loading ? (
            <Spinner />
          ) : liked.length === 0 ? (
            <EmptyState message="Your Discover list is empty. Swipe right on tracks to add them." />
          ) : (
            <ClipTable
              items={liked}
              dateKey="likedAt"
              onPlay={handleClipPlay}
              actionLabel={removingSongId ? 'Removing...' : 'Remove'}
              onAction={(id) => void handleRemoveLiked(id)}
              busyId={removingSongId}
            />
          )}
        </TabsContent>

        <TabsContent value="favorites">
          {loading ? (
            <Spinner />
          ) : favorites.length === 0 ? (
            <EmptyState message="No starred favorites yet." />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Song</TableHead>
                    <TableHead>Artist</TableHead>
                    <TableHead>Saved</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {favorites.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <SongCell
                          title={item.title}
                          artworkUrl={item.artworkUrl}
                          subtitle={`${item.likeCount} likes`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link href={`/artist/${item.artistId}`} className="hover:underline">
                          {item.artistName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.likedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRemoveFavorite(item.id)}
                          disabled={removingSongId === item.id}
                        >
                          {removingSongId === item.id ? 'Removing...' : 'Remove'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="disliked">
          {loading ? (
            <Spinner />
          ) : disliked.length === 0 ? (
            <EmptyState message="No skipped tracks yet." />
          ) : (
            <ClipTable
              items={disliked}
              dateKey="likedAt"
              onPlay={handleClipPlay}
              actionLabel="Undo skip"
              onAction={(id) => void handleRemoveSwipe(id)}
              busyId={removingSongId}
            />
          )}
        </TabsContent>

        <TabsContent value="purchases">
          {loading ? (
            <Spinner />
          ) : purchases.length === 0 ? (
            <EmptyState message="No purchased tracks yet." />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Song</TableHead>
                    <TableHead>Artist</TableHead>
                    <TableHead>Purchased</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <SongCell title={item.title} artworkUrl={item.artworkUrl} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/artist/${item.artistId}`} className="hover:underline">
                          {item.artistName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.purchasedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDownload(item.id)}
                          disabled={downloadingId === item.id}
                        >
                          {downloadingId === item.id ? 'Opening…' : 'Download'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="artists" className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void searchArtists();
            }}
          >
            <Input
              value={artistSearch}
              onChange={(e) => setArtistSearch(e.target.value)}
              placeholder="Search artists"
            />
            <Button type="submit">Search</Button>
          </form>
          {artistResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Search results</p>
              {artistResults.map((person) => {
                const id = person.userId || person.id;
                if (!id) return null;
                return (
                  <Link
                    key={id}
                    href={`/artist/${id}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/40"
                  >
                    {person.avatarUrl ? (
                      <Image
                        src={person.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                        unoptimized={shouldUnoptimize(person.avatarUrl)}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted" />
                    )}
                    <div>
                      <p className="font-medium">{person.displayName || 'Artist'}</p>
                      {person.headline && (
                        <p className="text-xs text-muted-foreground">{person.headline}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          {loading ? (
            <Spinner />
          ) : artists.length === 0 ? (
            <EmptyState message="Like songs in Discover to see those artists here." />
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Artists you liked</p>
              {artists.map((artist) => (
                <Link
                  key={artist.userId}
                  href={`/artist/${artist.userId}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/40"
                >
                  {artist.avatarUrl ? (
                    <Image
                      src={artist.avatarUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                      unoptimized={shouldUnoptimize(artist.avatarUrl)}
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{artist.displayName || 'Artist'}</p>
                    <p className="text-xs text-muted-foreground">
                      {artist.likedSongCount} liked song{artist.likedSongCount === 1 ? '' : 's'}
                      {artist.headline ? ` · ${artist.headline}` : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="pt-8 pb-8 text-center space-y-3">
        <p className="text-muted-foreground">{message}</p>
        <Button asChild>
          <Link href="/social/discover">Start swiping</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SongCell({
  title,
  artworkUrl,
  subtitle,
}: {
  title: string;
  artworkUrl?: string | null;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {artworkUrl ? (
        <Image
          src={artworkUrl}
          alt={title}
          width={44}
          height={44}
          className="h-11 w-11 rounded object-cover"
          unoptimized={shouldUnoptimize(artworkUrl)}
        />
      ) : (
        <div className="h-11 w-11 rounded bg-muted flex items-center justify-center">🎵</div>
      )}
      <div className="min-w-0">
        <p className="font-medium truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function ClipTable({
  items,
  dateKey,
  onPlay,
  actionLabel,
  onAction,
  busyId,
}: {
  items: DiscoverLikedItem[];
  dateKey: 'likedAt';
  onPlay: (el: HTMLAudioElement) => void;
  actionLabel: string;
  onAction: (songId: string) => void;
  busyId: string | null;
}) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Song</TableHead>
            <TableHead>Artist</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Clip</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.songId}>
              <TableCell>
                <SongCell
                  title={item.title}
                  artworkUrl={item.backgroundUrl}
                  subtitle={`${item.likeCount} likes`}
                />
              </TableCell>
              <TableCell>
                <Link href={`/artist/${item.artistId}`} className="hover:underline">
                  {item.artistDisplayName ?? item.artistName}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(item[dateKey]).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </TableCell>
              <TableCell className="min-w-[260px]">
                {item.clipUrl ? (
                  <audio
                    controls
                    preload="metadata"
                    src={item.clipUrl}
                    className="w-full"
                    onPlay={(e) => onPlay(e.currentTarget)}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No clip</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAction(item.songId)}
                  disabled={busyId === item.songId}
                >
                  {busyId === item.songId ? 'Working...' : actionLabel}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
