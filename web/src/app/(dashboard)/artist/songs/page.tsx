'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { songsApi, refineryApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type ApiError = { response?: { data?: { message?: string } } };

function errorMessage(err: unknown, fallback: string): string {
  const msg =
    err && typeof err === 'object'
      ? (err as ApiError).response?.data?.message
      : undefined;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface Song {
  id: string;
  title: string;
  artistName: string;
  artworkUrl?: string;
  durationSeconds?: number;
  creditsRemaining: number;
  playCount: number;
  likeCount: number;
  status: 'pending' | 'approved' | 'rejected';
  optInFreePlay: boolean;
  inRefinery?: boolean;
  rejectionReason?: string;
  rejectedAt?: string;
  createdAt: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved': return 'default';
    case 'rejected': return 'destructive';
    default: return 'secondary';
  }
}

export default function MySongsPage() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refineryToggling, setRefineryToggling] = useState<string | null>(null);

  useEffect(() => {
    loadSongs();
  }, []);

  const toggleRefinery = async (songId: string, currentlyInRefinery: boolean) => {
    setRefineryToggling(songId);
    try {
      if (currentlyInRefinery) {
        await refineryApi.removeSong(songId);
      } else {
        await refineryApi.addSong(songId);
      }
      await loadSongs();
    } catch {
      setError('Failed to update Refinery');
    } finally {
      setRefineryToggling(null);
    }
  };

  const loadSongs = async () => {
    try {
      setLoading(true);
      const response = await songsApi.getMine();
      setSongs(response.data);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load ores'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Ores</h1>
          <p className="text-muted-foreground mt-1">Manage your ores and buy plays for approved tracks</p>
        </div>
        <Button onClick={() => router.push('/artist/upload')}>Upload New Ore</Button>
      </div>

      {songs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-lg font-medium text-foreground mb-2">No ores yet</h3>
            <p className="text-muted-foreground mb-6">Upload your first ore to start promoting your music!</p>
            <Button onClick={() => router.push('/artist/upload')}>Upload Your First Ore</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ore</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Refinery</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Plays left</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {songs.map((song) => (
                <TableRow key={song.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        {song.artworkUrl ? (
                          <img className="h-10 w-10 rounded-lg object-cover" src={song.artworkUrl} alt={song.title} />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-primary">🎵</span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-foreground">{song.title}</div>
                        <div className="text-sm text-muted-foreground">{song.artistName}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(song.status)}>
                      {song.status === 'pending' ? 'Awaiting Review' : song.status.charAt(0).toUpperCase() + song.status.slice(1)}
                    </Badge>
                    {song.status === 'rejected' && song.rejectionReason && (
                      <div className="text-xs text-destructive mt-1" title={song.rejectionReason}>
                        {song.rejectionReason.substring(0, 30)}...
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={song.inRefinery ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={refineryToggling === song.id}
                      onClick={() => toggleRefinery(song.id, !!song.inRefinery)}
                    >
                      {refineryToggling === song.id ? '…' : song.inRefinery ? 'Remove from Refinery' : 'Add to Refinery'}
                    </Button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDuration(song.durationSeconds)}</TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">{song.creditsRemaining} plays</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">{song.playCount} plays</div>
                    <div className="text-xs text-muted-foreground">{song.likeCount} ripples</div>
                  </TableCell>
                  <TableCell>
                    {song.status === 'approved' ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => router.push(`/artist/songs/${song.id}/buy-plays`)}
                      >
                        Buy plays
                      </Button>
                    ) : song.status === 'pending' ? (
                      <span className="text-muted-foreground">Pending review</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
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
