'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Song {
  id: string;
  title: string;
  artist_name: string;
  artwork_url: string | null;
  audio_url: string;
  duration_seconds?: number;
  credits_remaining?: number;
  trial_plays_remaining?: number;
  opt_in_free_play?: boolean;
  admin_free_rotation?: boolean;
  paid_play_count?: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  users?: {
    display_name: string;
    email: string;
  };
}

type SortField = 'title' | 'artist' | 'created_at' | 'status';
type SortOrder = 'asc' | 'desc';

export default function AdminSongsPage() {
  const searchParams = useSearchParams();
  const [songs, setSongs] = useState<Song[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Rejection modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadSongs();
  }, [filter, debouncedSearch, sortBy, sortOrder]);

  const loadSongs = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getSongs({
        status: filter,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
        limit: 100,
      });
      setSongs(response.data.songs || []);
    } catch (err) {
      console.error('Failed to load songs:', err);
      setError('Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <span className="text-muted-foreground ml-1">↕</span>;
    return <span className="text-primary ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleToggleFreeRotation = async (song: Song) => {
    if (!song.opt_in_free_play) {
      toast.error('Artist has not opted into free play');
      return;
    }

    setActionLoading(song.id);
    try {
      await adminApi.toggleFreeRotation(song.id, !song.admin_free_rotation);
      setSongs(songs.map(s => 
        s.id === song.id ? { ...s, admin_free_rotation: !song.admin_free_rotation } : s
      ));
      toast.success('Free rotation updated');
    } catch (err) {
      console.error('Failed to toggle free rotation:', err);
      toast.error('Failed to toggle free rotation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (songId: string) => {
    setActionLoading(songId);
    try {
      await adminApi.updateSongStatus(songId, 'approved');
      setSongs(songs.map(s => 
        s.id === songId ? { ...s, status: 'approved' } : s
      ));
      toast.success('Song approved');
    } catch (err) {
      console.error('Failed to approve song:', err);
      toast.error('Failed to approve song');
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (songId: string) => {
    setRejectingId(songId);
    setRejectionReason('');
  };

  const handleReject = async () => {
    if (!rejectingId) return;

    setActionLoading(rejectingId);
    try {
      await adminApi.updateSongStatus(rejectingId, 'rejected', rejectionReason || undefined);
      setSongs(songs.map(s =>
        s.id === rejectingId ? { ...s, status: 'rejected', rejection_reason: rejectionReason } : s
      ));
      setRejectingId(null);
      setRejectionReason('');
      toast.success('Song rejected');
    } catch (err) {
      console.error('Failed to reject song:', err);
      toast.error('Failed to reject song');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setActionLoading(deletingId);
    try {
      await adminApi.deleteSong(deletingId);
      setSongs(songs.filter(s => s.id !== deletingId));
      setDeletingId(null);
      toast.success('Song deleted');
    } catch (err) {
      console.error('Failed to delete song:', err);
      toast.error('Failed to delete song');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {uploadSuccess && (
        <Alert>
          <AlertDescription>
            Song added. Approve it and enable free rotation below.
            <Button variant="link" className="ml-2 p-0 h-auto" onClick={() => setUploadSuccess(false)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
        <div className="flex gap-3 items-center">
          <Input
            type="text"
            placeholder="Search songs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select
            value={`${sortBy}-${sortOrder}`}
            onValueChange={(v) => {
              const [field, order] = v.split('-') as [SortField, SortOrder];
              setSortBy(field);
              setSortOrder(order);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at-desc">Newest First</SelectItem>
              <SelectItem value="created_at-asc">Oldest First</SelectItem>
              <SelectItem value="title-asc">Title A-Z</SelectItem>
              <SelectItem value="title-desc">Title Z-A</SelectItem>
              <SelectItem value="artist-asc">Artist A-Z</SelectItem>
              <SelectItem value="artist-desc">Artist Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : songs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No songs found with status: {filter}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('title')}>Song <SortIcon field="title" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('artist')}>Artist <SortIcon field="artist" /></TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>Status <SortIcon field="status" /></TableHead>
                <TableHead>Free Rotation</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('created_at')}>Submitted <SortIcon field="created_at" /></TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {songs.map((song) => (
                <TableRow key={song.id}>
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
                  <TableCell>
                    <div>
                      <p className="text-foreground">{song.artist_name}</p>
                      {song.users && (
                        <p className="text-xs text-muted-foreground">{song.users.email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {formatDuration(song.duration_seconds)}
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${(song.credits_remaining || 0) > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {song.credits_remaining || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={song.status === 'pending' ? 'secondary' : song.status === 'approved' ? 'default' : 'destructive'}>
                      {song.status}
                    </Badge>
                    {song.status === 'rejected' && song.rejection_reason && (
                      <p className="text-xs text-destructive mt-1 max-w-[150px] truncate" title={song.rejection_reason}>
                        {song.rejection_reason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {song.status === 'approved' ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!song.admin_free_rotation}
                          onCheckedChange={() => handleToggleFreeRotation(song)}
                          disabled={actionLoading === song.id || !song.opt_in_free_play}
                          title={!song.opt_in_free_play ? 'Artist has not opted in' : song.admin_free_rotation ? 'In free rotation' : 'Not in free rotation'}
                        />
                        <span className="text-xs text-muted-foreground">{song.paid_play_count || 0} plays</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(song.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {song.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(song.id)} disabled={actionLoading === song.id}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openRejectModal(song.id)} disabled={actionLoading === song.id}>
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeletingId(song.id)}
                        disabled={actionLoading === song.id}
                      >
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

      <AlertDialog open={!!rejectingId} onOpenChange={(open) => { if (!open) { setRejectingId(null); setRejectionReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Song</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a reason for rejection (optional). The artist will be notified and have 48 hours to respond before the song is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g., Audio quality issues, copyright concerns, explicit content..."
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading === rejectingId}
            >
              {actionLoading === rejectingId ? 'Rejecting...' : 'Reject Song'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Song</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the song from the database and remove all associated files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading === deletingId}
            >
              {actionLoading === deletingId ? 'Deleting...' : 'Delete Song'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
