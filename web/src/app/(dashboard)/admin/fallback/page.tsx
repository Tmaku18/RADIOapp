'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FallbackSong {
  id: string;
  title: string;
  artist_name: string;
  audio_url: string;
  artwork_url?: string;
  duration_seconds: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminFallbackPage() {
  const searchParams = useSearchParams();
  const [songs, setSongs] = useState<FallbackSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    loadSongs();
  }, []);

  useEffect(() => {
    if (searchParams.get('upload') === 'success') {
      setUploadSuccess(true);
      window.history.replaceState({}, '', '/admin/fallback');
    }
  }, [searchParams]);

  const loadSongs = async () => {
    try {
      const response = await adminApi.getFallbackSongs();
      setSongs(response.data.songs || []);
    } catch (err) {
      console.error('Failed to load fallback songs:', err);
      setError('Failed to load fallback playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (songId: string, currentActive: boolean) => {
    setActionLoading(songId);
    try {
      await adminApi.updateFallbackSong(songId, { isActive: !currentActive });
      setSongs(songs.map(s =>
        s.id === songId ? { ...s, is_active: !currentActive } : s
      ));
    } catch (err) {
      console.error('Failed to update song:', err);
      setError('Failed to update song');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (songId: string) => {
    if (!confirm('Are you sure you want to delete this song from the fallback playlist?')) {
      return;
    }

    setActionLoading(songId);
    try {
      await adminApi.deleteFallbackSong(songId);
      setSongs(songs.filter(s => s.id !== songId));
    } catch (err) {
      console.error('Failed to delete song:', err);
      setError('Failed to delete song');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeCount = songs.filter(s => s.is_active).length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fallback Playlist</h1>
          <p className="text-gray-600 mt-1">
            These songs play when no credited or opt-in songs are available.
            {activeCount > 0 && ` ${activeCount} active songs.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link href="/admin/fallback/upload">Upload Song</Link></Button>
          <Button variant="outline" asChild><Link href="/admin/fallback/song-database">View Song Database</Link></Button>
        </div>
      </div>

      {uploadSuccess && (
        <Alert>
          <AlertDescription>
            Song uploaded successfully.
            <Button variant="link" className="ml-2 p-0 h-auto" onClick={() => setUploadSuccess(false)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            <Button variant="link" className="ml-2 p-0 h-auto text-destructive" onClick={() => setError(null)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        {songs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="text-4xl mb-4">🎵</div>
            <p>No fallback songs yet.</p>
            <p className="text-sm mt-2">Add royalty-free or licensed music for when no paid content is available.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Song</TableHead>
                <TableHead>Artist</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {songs.map((song) => (
                <TableRow key={song.id} className={!song.is_active ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center mr-3">
                        {song.artwork_url ? (
                          <img
                            src={song.artwork_url}
                            alt={song.title}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <span>🎵</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{song.title}</p>
                        {song.audio_url && (
                          <audio controls className="h-6 mt-1">
                            <source src={song.audio_url} type="audio/mpeg" />
                          </audio>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{song.artist_name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{formatDuration(song.duration_seconds)}</TableCell>
                  <TableCell>
                    <Badge variant={song.is_active ? 'default' : 'secondary'}>{song.is_active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant={song.is_active ? 'secondary' : 'default'} onClick={() => handleToggleActive(song.id, song.is_active)} disabled={actionLoading === song.id}>
                        {song.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(song.id)} disabled={actionLoading === song.id}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
