'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { songsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      setLoading(true);
      const response = await songsApi.getMine();
      setSongs(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const calculateCreditsPerPlay = (durationSeconds?: number): number => {
    return Math.ceil((durationSeconds || 180) / 5);
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
          <h1 className="text-2xl font-bold text-foreground">My Songs</h1>
          <p className="text-muted-foreground mt-1">Manage your uploaded songs and allocate credits</p>
        </div>
        <Button onClick={() => router.push('/artist/upload')}>Upload New Song</Button>
      </div>

      {songs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-lg font-medium text-foreground mb-2">No songs yet</h3>
            <p className="text-muted-foreground mb-6">Upload your first song to start promoting your music!</p>
            <Button onClick={() => router.push('/artist/upload')}>Upload Your First Song</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Song</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Plays</TableHead>
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
                  <TableCell className="text-muted-foreground">{formatDuration(song.durationSeconds)}</TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">{song.creditsRemaining} credits</div>
                    <div className="text-xs text-muted-foreground">{calculateCreditsPerPlay(song.durationSeconds)} per play</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">{song.playCount}</div>
                    <div className="text-xs text-muted-foreground">{song.likeCount} likes</div>
                  </TableCell>
                  <TableCell>
                    {song.status === 'approved' ? (
                      <Button variant="link" className="p-0 h-auto" onClick={() => router.push(`/artist/songs/${song.id}/allocate`)}>
                        Allocate Credits
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
