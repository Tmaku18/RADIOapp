'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { songsApi, refineryApi } from '@/lib/api';
import { TOWERS } from '@/data/station-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArtworkImage } from '@/components/common/ArtworkImage';

type ApiError = { response?: { status?: number; data?: { message?: string } } };

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
  stationId?: string;
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
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStationId, setEditStationId] = useState('');
  const [editArtworkUrl, setEditArtworkUrl] = useState('');
  const [editArtworkFile, setEditArtworkFile] = useState<File | null>(null);
  const [editArtworkPreview, setEditArtworkPreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

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
      setError(null);
      const response = await songsApi.getMine();
      setSongs(response.data);
    } catch (err: unknown) {
      const status = (err as ApiError).response?.status;
      const msg = errorMessage(err, 'Failed to load songs. If this persists, check that BACKEND_URL is set on Vercel.');
      if (status === 403) {
        setError(
          'You need an artist account to view My Songs. Upgrade in Settings or sign up as an artist to upload and manage songs.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const getArtworkPublicUrl = (path: string): string => {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    if (!base) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
    }
    return `${base}/storage/v1/object/public/artwork/${path}`;
  };

  const uploadArtwork = async (file: File): Promise<string> => {
    const response = await songsApi.getUploadUrl({
      filename: file.name,
      contentType: file.type || 'image/jpeg',
      bucket: 'artwork',
    });
    const { signedUrl, path } = response.data as { signedUrl: string; path: string };
    const uploadResponse = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'image/jpeg',
      },
    });
    if (!uploadResponse.ok) {
      throw new Error(`Artwork upload failed (${uploadResponse.status})`);
    }
    return getArtworkPublicUrl(path);
  };

  const openEditModal = (song: Song) => {
    setEditingSong(song);
    setEditTitle(song.title);
    setEditStationId(song.stationId || '');
    setEditArtworkUrl(song.artworkUrl || '');
    setEditArtworkFile(null);
    setEditArtworkPreview(song.artworkUrl || null);
  };

  const closeEditModal = () => {
    setEditingSong(null);
    setEditArtworkFile(null);
    setEditArtworkPreview(null);
    setEditSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editingSong) return;
    const nextTitle = editTitle.trim();
    if (!nextTitle) {
      setError('Title cannot be empty');
      return;
    }
    if (!editStationId) {
      setError('Please select a station/category');
      return;
    }
    setEditSaving(true);
    try {
      let finalArtworkUrl = editArtworkUrl.trim();
      if (editArtworkFile) {
        finalArtworkUrl = await uploadArtwork(editArtworkFile);
      }
      const response = await songsApi.update(editingSong.id, {
        title: nextTitle,
        stationId: editStationId,
        artworkUrl: finalArtworkUrl,
      });
      const updated = response.data as {
        id: string;
        title: string;
        stationId?: string;
        artworkUrl?: string | null;
      };
      setSongs((prev) =>
        prev.map((song) =>
          song.id === editingSong.id
            ? {
                ...song,
                title: updated.title ?? nextTitle,
                stationId: updated.stationId ?? editStationId,
                artworkUrl:
                  updated.artworkUrl !== undefined ? updated.artworkUrl || undefined : finalArtworkUrl || undefined,
              }
            : song,
        ),
      );
      closeEditModal();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to update song metadata'));
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Songs</h1>
          <p className="text-muted-foreground mt-1">Manage your uploaded songs and buy plays for approved tracks</p>
        </div>
        <Button onClick={() => router.push('/artist/upload')}>Upload New Song</Button>
      </div>

      {error && (
        <Alert variant="destructive" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <AlertDescription>{error}</AlertDescription>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => { setError(null); loadSongs(); }}>
              Retry
            </Button>
            <Button size="sm" onClick={() => router.push('/artist/upload')}>
              Upload Ore
            </Button>
          </div>
        </Alert>
      )}

      {!error && songs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-lg font-medium text-foreground mb-2">No songs yet</h3>
            <p className="text-muted-foreground mb-6">Upload your first song to get on the radio and buy plays for approved tracks.</p>
            <Button onClick={() => router.push('/artist/upload')}>Upload Your First Ore</Button>
          </CardContent>
        </Card>
      ) : !error ? (
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
                        <ArtworkImage
                          src={song.artworkUrl}
                          alt={song.title}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
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
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(song)}>
                          Edit
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => router.push(`/artist/songs/${song.id}/buy-plays`)}
                        >
                          Buy plays
                        </Button>
                      </div>
                    ) : song.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(song)}>
                          Edit
                        </Button>
                        <span className="text-muted-foreground">Pending review</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(song)}>
                          Edit
                        </Button>
                        <span className="text-muted-foreground">N/A</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {editingSong && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-lg border bg-card p-5 space-y-4">
            <h3 className="text-lg font-semibold">Edit Song Metadata</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Song title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Station / Genre</label>
              <select
                value={editStationId}
                onChange={(e) => setEditStationId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a station</option>
                {TOWERS.map((tower) => (
                  <option key={tower.id} value={tower.id}>
                    {tower.genre} ({tower.city})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Album Cover URL</label>
              <input
                value={editArtworkUrl}
                onChange={(e) => setEditArtworkUrl(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="https://..."
              />
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setEditArtworkFile(file);
                    if (file) {
                      const preview = URL.createObjectURL(file);
                      setEditArtworkPreview(preview);
                    } else {
                      setEditArtworkPreview(editArtworkUrl || null);
                    }
                  }}
                  className="text-sm"
                />
                {editArtworkFile && <span className="text-xs text-muted-foreground">{editArtworkFile.name}</span>}
              </div>
              {editArtworkPreview && (
                <ArtworkImage
                  src={editArtworkPreview}
                  alt="Artwork preview"
                  className="h-16 w-16 rounded object-cover border border-border"
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeEditModal} disabled={editSaving}>
                Cancel
              </Button>
              <Button onClick={() => void handleSaveEdit()} disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
