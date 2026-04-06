'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { songsApi, refineryApi } from '@/lib/api';
import { TOWERS } from '@/data/station-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { SongLikesDialog } from '@/components/songs/SongLikesDialog';

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
  listenCount?: number;
  likeCount: number;
  status: 'pending' | 'approved' | 'rejected';
  stationId?: string;
  discoverEnabled?: boolean;
  discoverClipUrl?: string | null;
  discoverBackgroundUrl?: string | null;
  discoverClipStartSeconds?: number | null;
  discoverClipEndSeconds?: number | null;
  discoverClipDurationSeconds?: number | null;
  optInFreePlay: boolean;
  inRefinery?: boolean;
  rejectionReason?: string;
  rejectedAt?: string;
  createdAt: string;
  featuredArtists?: Array<{
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  }>;
  isExplicit?: boolean;
}

function parseTimeToSeconds(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.includes(':')) {
    const parts = raw.split(':').map((part) => part.trim());
    if (
      parts.length < 2 ||
      parts.length > 3 ||
      parts.some((part) => part.length === 0)
    ) {
      return null;
    }
    let total = 0;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const parsed =
        i === parts.length - 1 ? Number(part) : Number.parseInt(part, 10);
      if (!Number.isFinite(parsed) || parsed < 0) return null;
      total = total * 60 + parsed;
    }
    return total;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatSecondsForTrimInput(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  if (!Number.isInteger(seconds)) return seconds.toString();
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  const [editDiscoverEnabled, setEditDiscoverEnabled] = useState(false);
  const [editDiscoverBackgroundFile, setEditDiscoverBackgroundFile] = useState<File | null>(null);
  const [editDiscoverBackgroundPreview, setEditDiscoverBackgroundPreview] = useState<string | null>(null);
  const [editDiscoverClipStartSeconds, setEditDiscoverClipStartSeconds] = useState('0');
  const [editDiscoverClipEndSeconds, setEditDiscoverClipEndSeconds] = useState('15');
  const [editIsExplicit, setEditIsExplicit] = useState(false);
  const [editFeaturedArtists, setEditFeaturedArtists] = useState<
    Array<{ id: string; displayName: string | null; avatarUrl: string | null }>
  >([]);
  const [featuredSearchQuery, setFeaturedSearchQuery] = useState('');
  const [featuredSearchResults, setFeaturedSearchResults] = useState<
    Array<{ id: string; displayName: string | null; avatarUrl: string | null }>
  >([]);
  const [featuredSearchLoading, setFeaturedSearchLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [discoverActionSongId, setDiscoverActionSongId] = useState<string | null>(
    null,
  );
  const [likesDialogOpen, setLikesDialogOpen] = useState(false);
  const [likesDialogSongId, setLikesDialogSongId] = useState<string | null>(null);
  const [likesDialogSongTitle, setLikesDialogSongTitle] = useState<string>('');

  useEffect(() => {
    loadSongs();
  }, []);

  useEffect(() => {
    const query = featuredSearchQuery.trim();
    if (!editingSong || query.length < 2) {
      setFeaturedSearchResults([]);
      setFeaturedSearchLoading(false);
      return;
    }
    let cancelled = false;
    setFeaturedSearchLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await songsApi.searchArtists(query, 12);
        if (cancelled) return;
        const selectedIds = new Set(editFeaturedArtists.map((a) => a.id));
        const items = (res.data?.items ?? []).filter(
          (a) => !selectedIds.has(a.id),
        );
        setFeaturedSearchResults(items);
      } catch {
        if (!cancelled) setFeaturedSearchResults([]);
      } finally {
        if (!cancelled) setFeaturedSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [featuredSearchQuery, editingSong, editFeaturedArtists]);

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
    setEditDiscoverEnabled(song.discoverEnabled === true);
    setEditDiscoverBackgroundFile(null);
    setEditDiscoverBackgroundPreview(song.discoverBackgroundUrl || song.artworkUrl || null);
    setEditDiscoverClipStartSeconds(
      formatSecondsForTrimInput(song.discoverClipStartSeconds ?? 0),
    );
    setEditDiscoverClipEndSeconds(
      formatSecondsForTrimInput(song.discoverClipEndSeconds ?? 15),
    );
    setEditFeaturedArtists(song.featuredArtists || []);
    setEditIsExplicit(song.isExplicit === true);
    setFeaturedSearchQuery('');
    setFeaturedSearchResults([]);
  };

  const closeEditModal = () => {
    setEditingSong(null);
    setEditArtworkFile(null);
    setEditArtworkPreview(null);
    setEditDiscoverBackgroundFile(null);
    setEditDiscoverBackgroundPreview(null);
    setEditFeaturedArtists([]);
    setFeaturedSearchQuery('');
    setFeaturedSearchResults([]);
    setEditSaving(false);
  };

  const handleDeleteSong = async (song: Song) => {
    if (deletingSongId) return;
    const confirmed = window.confirm(
      `Delete "${song.title}"? This removes the song and related analytics data and cannot be undone.`,
    );
    if (!confirmed) return;
    setDeletingSongId(song.id);
    setError(null);
    try {
      await songsApi.delete(song.id);
      if (editingSong?.id === song.id) {
        closeEditModal();
      }
      setSongs((prev) => prev.filter((row) => row.id !== song.id));
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete song'));
    } finally {
      setDeletingSongId(null);
    }
  };

  const unpublishDiscoverForSong = async (song: Song) => {
    setDiscoverActionSongId(song.id);
    setError(null);
    try {
      await songsApi.unpublishDiscoverFromLibrary(song.id);
      setSongs((prev) =>
        prev.map((row) =>
          row.id === song.id
            ? {
                ...row,
                discoverEnabled: false,
                discoverClipUrl: null,
                discoverBackgroundUrl: null,
                discoverClipStartSeconds: null,
                discoverClipEndSeconds: null,
                discoverClipDurationSeconds: null,
              }
            : row,
        ),
      );
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete Discover swipe clip'));
    } finally {
      setDiscoverActionSongId(null);
    }
  };

  const repostDiscoverForSong = async (song: Song) => {
    setDiscoverActionSongId(song.id);
    setError(null);
    try {
      const clipStartSeconds = song.discoverClipStartSeconds ?? 0;
      const clipEndSeconds = song.discoverClipEndSeconds ?? 15;
      const publishResponse = await songsApi.publishDiscoverFromLibrary(song.id, {
        clipStartSeconds,
        clipEndSeconds,
        discoverBackgroundUrl:
          song.discoverBackgroundUrl || song.artworkUrl || undefined,
      });
      const updated = publishResponse.data as {
        discoverEnabled?: boolean;
        discoverClipUrl?: string | null;
        discoverBackgroundUrl?: string | null;
        discoverClipStartSeconds?: number | null;
        discoverClipEndSeconds?: number | null;
        discoverClipDurationSeconds?: number | null;
      };
      setSongs((prev) =>
        prev.map((row) =>
          row.id === song.id
            ? {
                ...row,
                discoverEnabled: updated.discoverEnabled ?? true,
                discoverClipUrl: updated.discoverClipUrl ?? row.discoverClipUrl,
                discoverBackgroundUrl:
                  updated.discoverBackgroundUrl ?? row.discoverBackgroundUrl,
                discoverClipStartSeconds:
                  updated.discoverClipStartSeconds ?? clipStartSeconds,
                discoverClipEndSeconds:
                  updated.discoverClipEndSeconds ?? clipEndSeconds,
                discoverClipDurationSeconds:
                  updated.discoverClipDurationSeconds ??
                  clipEndSeconds - clipStartSeconds,
              }
            : row,
        ),
      );
    } catch (err) {
      setError(errorMessage(err, 'Failed to repost Discover swipe clip'));
    } finally {
      setDiscoverActionSongId(null);
    }
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
    if (editDiscoverEnabled) {
      const start = parseTimeToSeconds(editDiscoverClipStartSeconds);
      const end = parseTimeToSeconds(editDiscoverClipEndSeconds);
      if (start == null || end == null || end <= start) {
        setError(
          'Discover clip start/end must be valid (mm:ss or seconds) and end must be greater than start',
        );
        return;
      }
      if (end - start > 15) {
        setError('Discover clip duration must be 15 seconds or less');
        return;
      }
    }
    setEditSaving(true);
    try {
      let finalArtworkUrl = editArtworkUrl.trim();
      if (editArtworkFile) {
        finalArtworkUrl = await uploadArtwork(editArtworkFile);
      }
      let finalDiscoverBackgroundUrl =
        editDiscoverBackgroundPreview || editingSong.discoverBackgroundUrl || finalArtworkUrl;
      if (editDiscoverBackgroundFile) {
        finalDiscoverBackgroundUrl = await uploadArtwork(editDiscoverBackgroundFile);
      }
      const updateResponse = await songsApi.update(editingSong.id, {
        title: nextTitle,
        stationId: editStationId,
        artworkUrl: finalArtworkUrl,
        discoverEnabled: editDiscoverEnabled,
        featuredArtistIds: editFeaturedArtists.map((a) => a.id),
        isExplicit: editIsExplicit,
      });

      let discoverUpdated:
        | {
            discoverEnabled?: boolean;
            discoverClipUrl?: string | null;
            discoverBackgroundUrl?: string | null;
            discoverClipStartSeconds?: number | null;
            discoverClipEndSeconds?: number | null;
            discoverClipDurationSeconds?: number | null;
          }
        | null = null;

      if (editDiscoverEnabled) {
        const start = parseTimeToSeconds(editDiscoverClipStartSeconds);
        const end = parseTimeToSeconds(editDiscoverClipEndSeconds);
        if (start == null || end == null) {
          throw new Error('Invalid discover clip trim values.');
        }
        const publishResponse = await songsApi.publishDiscoverFromLibrary(
          editingSong.id,
          {
            clipStartSeconds: start,
            clipEndSeconds: end,
            discoverBackgroundUrl: finalDiscoverBackgroundUrl || undefined,
          },
        );
        discoverUpdated = publishResponse.data as {
          discoverEnabled?: boolean;
          discoverClipUrl?: string | null;
          discoverBackgroundUrl?: string | null;
          discoverClipStartSeconds?: number | null;
          discoverClipEndSeconds?: number | null;
          discoverClipDurationSeconds?: number | null;
        };
      }

      const updated = updateResponse.data as {
        id: string;
        title: string;
        stationId?: string;
        artworkUrl?: string | null;
        discoverEnabled?: boolean;
        discoverClipUrl?: string | null;
        discoverBackgroundUrl?: string | null;
        discoverClipStartSeconds?: number | null;
        discoverClipEndSeconds?: number | null;
        discoverClipDurationSeconds?: number | null;
        featuredArtists?: Array<{
          id: string;
          displayName: string | null;
          avatarUrl: string | null;
        }>;
        isExplicit?: boolean;
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
                discoverEnabled:
                  discoverUpdated?.discoverEnabled ??
                  updated.discoverEnabled ??
                  editDiscoverEnabled,
                discoverClipUrl:
                  discoverUpdated?.discoverClipUrl !== undefined
                    ? discoverUpdated.discoverClipUrl || undefined
                    : song.discoverClipUrl,
                discoverBackgroundUrl:
                  discoverUpdated?.discoverBackgroundUrl !== undefined
                    ? discoverUpdated.discoverBackgroundUrl || undefined
                    : finalDiscoverBackgroundUrl || undefined,
                discoverClipStartSeconds:
                  discoverUpdated?.discoverClipStartSeconds ??
                  updated.discoverClipStartSeconds ??
                  (parseTimeToSeconds(editDiscoverClipStartSeconds) ?? 0),
                discoverClipEndSeconds:
                  discoverUpdated?.discoverClipEndSeconds ??
                  updated.discoverClipEndSeconds ??
                  (parseTimeToSeconds(editDiscoverClipEndSeconds) ?? 15),
                discoverClipDurationSeconds:
                  discoverUpdated?.discoverClipDurationSeconds ??
                  updated.discoverClipDurationSeconds ??
                  (parseTimeToSeconds(editDiscoverClipEndSeconds) ?? 15) -
                    (parseTimeToSeconds(editDiscoverClipStartSeconds) ?? 0),
                featuredArtists: updated.featuredArtists ?? editFeaturedArtists,
                isExplicit:
                  updated.isExplicit !== undefined
                    ? updated.isExplicit
                    : editIsExplicit,
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
          <p className="text-muted-foreground mt-1">Manage your uploaded songs and track performance</p>
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
              Upload Song
            </Button>
          </div>
        </Alert>
      )}

      {!error && songs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-lg font-medium text-foreground mb-2">No songs yet</h3>
            <p className="text-muted-foreground mb-6">Upload your first song to get on the radio.</p>
            <Button onClick={() => router.push('/artist/upload')}>Upload Your First Song</Button>
          </CardContent>
        </Card>
      ) : !error ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Song</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Discover</TableHead>
                <TableHead>Refinery</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Availability</TableHead>
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
                        <div className="text-xs text-muted-foreground">
                          {song.isExplicit ? 'Explicit' : 'Clean'}
                        </div>
                        <div className="text-sm text-muted-foreground">{song.artistName}</div>
                        {(song.featuredArtists?.length ?? 0) > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Feat:{' '}
                            {song.featuredArtists?.map((artist, index) => (
                              <React.Fragment key={artist.id}>
                                {index > 0 ? ', ' : null}
                                <Link
                                  href={`/artist/${artist.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {artist.displayName || 'Artist'}
                                </Link>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
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
                    {song.discoverEnabled ? (
                      <div className="text-xs text-muted-foreground space-y-2">
                        <p className="font-medium text-foreground">Enabled</p>
                        <p>
                          {(song.discoverClipDurationSeconds ?? 15).toString()}s clip
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={discoverActionSongId === song.id}
                          onClick={() => void unpublishDiscoverForSong(song)}
                        >
                          {discoverActionSongId === song.id
                            ? 'Deleting...'
                            : 'Delete Swipe'}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-xs text-muted-foreground block">Off</span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={discoverActionSongId === song.id}
                          onClick={() => void repostDiscoverForSong(song)}
                        >
                          {discoverActionSongId === song.id
                            ? 'Reposting...'
                            : 'Repost Swipe'}
                        </Button>
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
                    <div className="text-sm text-foreground">
                      {song.status === 'approved' ? 'Active' : 'Pending review'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">{song.listenCount ?? song.playCount} listens</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{song.likeCount} likes</span>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setLikesDialogSongId(song.id);
                          setLikesDialogSongTitle(song.title);
                          setLikesDialogOpen(true);
                        }}
                      >
                        View
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {song.status === 'approved' ? (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(song)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingSongId === song.id}
                          onClick={() => void handleDeleteSong(song)}
                        >
                          {deletingSongId === song.id ? 'Deleting...' : 'Delete song'}
                        </Button>
                      </div>
                    ) : song.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(song)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingSongId === song.id}
                          onClick={() => void handleDeleteSong(song)}
                        >
                          {deletingSongId === song.id ? 'Deleting...' : 'Delete song'}
                        </Button>
                        <span className="text-muted-foreground">Pending review</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(song)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingSongId === song.id}
                          onClick={() => void handleDeleteSong(song)}
                        >
                          {deletingSongId === song.id ? 'Deleting...' : 'Delete song'}
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
        <div className="fixed inset-0 z-50 bg-black/50 p-4 overflow-y-auto">
          <div className="mx-auto my-4 w-full max-w-xl rounded-lg border bg-card p-5 max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Song Metadata</h3>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                aria-label="Close edit modal"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto pr-1">
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
                    {tower.genre} (National)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">Explicit content</label>
                <input
                  type="checkbox"
                  checked={editIsExplicit}
                  onChange={(e) => setEditIsExplicit(e.target.checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Mark explicit when track audio includes explicit language/content.
              </p>
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
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">Enable Discover swipe</label>
                <input
                  type="checkbox"
                  checked={editDiscoverEnabled}
                  onChange={(e) => setEditDiscoverEnabled(e.target.checked)}
                />
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Discover clip source: this song&apos;s uploaded audio.
                Set start/end below to trim the clip (up to 15s), same flow as admin trim.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Clip start (mm:ss or seconds)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0:00"
                    value={editDiscoverClipStartSeconds}
                    onChange={(e) => setEditDiscoverClipStartSeconds(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Clip end (mm:ss or seconds)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0:15"
                    value={editDiscoverClipEndSeconds}
                    onChange={(e) => setEditDiscoverClipEndSeconds(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="text-sm font-medium">Discover Background Image (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setEditDiscoverBackgroundFile(file);
                    if (file) {
                      const preview = URL.createObjectURL(file);
                      setEditDiscoverBackgroundPreview(preview);
                    } else {
                      setEditDiscoverBackgroundPreview(
                        editingSong.discoverBackgroundUrl ||
                          editingSong.artworkUrl ||
                          null,
                      );
                    }
                  }}
                  className="text-sm"
                />
                {editDiscoverBackgroundFile && (
                  <span className="text-xs text-muted-foreground">{editDiscoverBackgroundFile.name}</span>
                )}
              </div>
              {editDiscoverBackgroundPreview && (
                <ArtworkImage
                  src={editDiscoverBackgroundPreview}
                  alt="Discover background preview"
                  className="h-16 w-16 rounded object-cover border border-border"
                />
              )}
            </div>
            <div className="space-y-2 rounded-md border border-border p-3">
              <label className="text-sm font-medium">
                Featured Artist Credits
              </label>
              <p className="text-xs text-muted-foreground">
                Tag other artists on Networx who are featured on this song.
              </p>
              <input
                value={featuredSearchQuery}
                onChange={(e) => setFeaturedSearchQuery(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Search artists by name"
              />
              {featuredSearchLoading && (
                <p className="text-xs text-muted-foreground">Searching...</p>
              )}
              {!featuredSearchLoading &&
                featuredSearchQuery.trim().length >= 2 &&
                featuredSearchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No matching artists found.
                  </p>
                )}
              {featuredSearchResults.length > 0 && (
                <div className="max-h-36 overflow-auto rounded border border-border divide-y divide-border">
                  {featuredSearchResults.map((artist) => (
                    <button
                      key={artist.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                      onClick={() => {
                        setEditFeaturedArtists((prev) => [
                          ...prev,
                          {
                            id: artist.id,
                            displayName: artist.displayName,
                            avatarUrl: artist.avatarUrl,
                          },
                        ]);
                        setFeaturedSearchQuery('');
                        setFeaturedSearchResults([]);
                      }}
                    >
                      {artist.displayName || 'Artist'}
                    </button>
                  ))}
                </div>
              )}
              {(editFeaturedArtists.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editFeaturedArtists.map((artist) => (
                    <span
                      key={artist.id}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
                    >
                      <Link
                        href={`/artist/${artist.id}`}
                        className="text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {artist.displayName || 'Artist'}
                      </Link>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setEditFeaturedArtists((prev) =>
                            prev.filter((a) => a.id !== artist.id),
                          )
                        }
                        aria-label={`Remove ${artist.displayName || 'artist'}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
              {editingSong && (
                <Button
                  variant="destructive"
                  onClick={() => void handleDeleteSong(editingSong)}
                  disabled={editSaving || deletingSongId === editingSong.id}
                  className="mr-auto"
                >
                  {deletingSongId === editingSong.id ? 'Deleting...' : 'Delete song'}
                </Button>
              )}
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
      <SongLikesDialog
        open={likesDialogOpen}
        onOpenChange={setLikesDialogOpen}
        songId={likesDialogSongId}
        songTitle={likesDialogSongTitle}
      />
    </div>
  );
}
