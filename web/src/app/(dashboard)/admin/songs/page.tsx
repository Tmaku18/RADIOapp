'use client';

import { useState, useEffect } from 'react';
import { adminApi, songsApi } from '@/lib/api';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { TOWERS } from '@/data/station-map';

interface Song {
  id: string;
  title: string;
  artist_name: string;
  station_id?: string | null;
  station_ids?: string[] | null;
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

function getErrorMessage(error: unknown, fallback: string): string {
  type MaybeApiError = { response?: { data?: { message?: unknown } } };
  const maybeApiError = error as MaybeApiError;
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    maybeApiError.response?.data?.message
  ) {
    const msg = maybeApiError.response?.data?.message;
    return typeof msg === 'string' ? msg : fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

type SortField = 'title' | 'created_at' | 'status';
type SortOrder = 'asc' | 'desc';

export default function AdminSongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [durationOverrides, setDurationOverrides] = useState<Record<string, number>>({});
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStationIds, setEditStationIds] = useState<string[]>([]);
  const [editArtworkUrl, setEditArtworkUrl] = useState('');
  const [editArtworkFile, setEditArtworkFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  
  // Rejection modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [trimmingSong, setTrimmingSong] = useState<Song | null>(null);
  const [trimStartSeconds, setTrimStartSeconds] = useState(0);
  const [trimEndSeconds, setTrimEndSeconds] = useState(0);
  
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

  // If backend duration_seconds is missing/default, try to read duration from the audio URL metadata.
  // This fixes legacy rows that were stored with the 180s fallback.
  useEffect(() => {
    let cancelled = false;

    const candidates = songs.filter((s) => {
      const existingOverride = durationOverrides[s.id];
      if (existingOverride && existingOverride > 0) return false;
      if (!s.audio_url) return false;
      return !s.duration_seconds || s.duration_seconds === 180;
    });

    candidates.forEach((song) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = song.audio_url;

      const onLoaded = () => {
        if (cancelled) return;
        const seconds = Math.ceil(audio.duration || 0);
        if (seconds > 0) {
          setDurationOverrides((prev) => ({ ...prev, [song.id]: seconds }));
        }
        cleanup();
      };

      const onError = () => {
        cleanup();
      };

      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
        // Release any network resources.
        audio.src = '';
      };

      audio.addEventListener('loadedmetadata', onLoaded);
      audio.addEventListener('error', onError);
    });

    return () => {
      cancelled = true;
    };
    // Intentionally not depending on durationOverrides to avoid retrigger loops.
     
  }, [songs]);

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
      setError("Failed to load songs");
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
    if (sortBy !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-purple-600 ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleToggleFreeRotation = async (song: Song) => {
    // Temporarily removed: paid-play requirement so rap radio can play nonstop (uploaded songs are rap)
    // if ((song.paid_play_count || 0) < 1) {
    //   alert('Song must have at least 1 paid play');
    //   return;
    // }

    setActionLoading(song.id);
    try {
      await adminApi.toggleFreeRotation(song.id, !song.admin_free_rotation);
      setSongs(songs.map(s => 
        s.id === song.id ? { ...s, admin_free_rotation: !song.admin_free_rotation } : s
      ));
    } catch (err) {
      console.error('Failed to toggle free rotation:', err);
      alert('Failed to toggle free rotation');
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
    } catch (err) {
      console.error('Failed to approve song:', err);
      alert('Failed to approve song');
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
    } catch (err) {
      console.error('Failed to reject song:', err);
      alert('Failed to reject song');
    } finally {
      setActionLoading(null);
    }
  };

  const openTrimModal = (song: Song) => {
    const duration = durationOverrides[song.id] ?? song.duration_seconds ?? 180;
    setTrimmingSong(song);
    setTrimStartSeconds(0);
    setTrimEndSeconds(duration);
  };

  const getTrimTotalSeconds = (song: Song) =>
    Math.max(1, durationOverrides[song.id] ?? song.duration_seconds ?? 180);

  const handleTrimStartDrag = (value: number) => {
    if (!trimmingSong) return;
    const total = getTrimTotalSeconds(trimmingSong);
    const nextStart = Math.max(0, Math.min(Math.floor(value), trimEndSeconds - 1));
    setTrimStartSeconds(Math.min(nextStart, total - 1));
  };

  const handleTrimEndDrag = (value: number) => {
    if (!trimmingSong) return;
    const total = getTrimTotalSeconds(trimmingSong);
    const nextEnd = Math.min(total, Math.max(Math.floor(value), trimStartSeconds + 1));
    setTrimEndSeconds(nextEnd);
  };

  const handleTrimSave = async () => {
    if (!trimmingSong) return;
    if (!Number.isFinite(trimStartSeconds) || !Number.isFinite(trimEndSeconds)) {
      alert('Trim values must be valid numbers');
      return;
    }
    if (trimStartSeconds < 0 || trimEndSeconds <= trimStartSeconds) {
      alert('End time must be greater than start time');
      return;
    }

    const actionKey = `trim:${trimmingSong.id}`;
    setActionLoading(actionKey);
    try {
      const response = await adminApi.trimSong(trimmingSong.id, {
        startSeconds: trimStartSeconds,
        endSeconds: trimEndSeconds,
      });
      const updatedSong = response.data?.song as Song | undefined;
      if (updatedSong) {
        setSongs((prev) =>
          prev.map((song) => (song.id === updatedSong.id ? { ...song, ...updatedSong } : song)),
        );
        setDurationOverrides((prev) => ({
          ...prev,
          [updatedSong.id]: updatedSong.duration_seconds || Math.ceil(trimEndSeconds - trimStartSeconds),
        }));
      }
      setTrimmingSong(null);
    } catch (err) {
      console.error('Failed to trim song:', err);
      alert('Failed to trim and save song');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSong = async (song: Song) => {
    const confirmed = window.confirm(
      `Delete "${song.title}" by ${song.artist_name}? This cannot be undone.`,
    );
    if (!confirmed) return;

    const actionKey = `delete:${song.id}`;
    setActionLoading(actionKey);
    try {
      await adminApi.deleteSong(song.id);
      setSongs((prev) => prev.filter((entry) => entry.id !== song.id));
    } catch (err) {
      console.error('Failed to delete song:', err);
      alert(getErrorMessage(err, 'Failed to delete song'));
    } finally {
      setActionLoading(null);
    }
  };

  const getArtworkPublicUrl = (path: string): string => {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    if (!base) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
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
      headers: { 'Content-Type': file.type || 'image/jpeg' },
    });
    if (!uploadResponse.ok) {
      throw new Error(`Artwork upload failed (${uploadResponse.status})`);
    }
    return getArtworkPublicUrl(path);
  };

  const openEditModal = (song: Song) => {
    setEditingSong(song);
    setEditTitle(song.title || '');
    const currentStations = Array.isArray(song.station_ids) && song.station_ids.length > 0
      ? song.station_ids
      : song.station_id
        ? [song.station_id]
        : [];
    setEditStationIds(currentStations);
    setEditArtworkUrl(song.artwork_url || '');
    setEditArtworkFile(null);
  };

  const closeEditModal = () => {
    setEditingSong(null);
    setEditArtworkFile(null);
    setEditSaving(false);
  };

  const handleSaveMetadata = async () => {
    if (!editingSong) return;
    const title = editTitle.trim();
    if (!title) {
      alert('Title cannot be empty');
      return;
    }
    if (editStationIds.length === 0) {
      alert('Please select at least one station');
      return;
    }
    setEditSaving(true);
    try {
      let finalArtworkUrl = editArtworkUrl.trim();
      if (editArtworkFile) {
        finalArtworkUrl = await uploadArtwork(editArtworkFile);
      }
      const response = await adminApi.updateSongMetadata(editingSong.id, {
        title,
        stationId: editStationIds[0],
        stationIds: editStationIds,
        artworkUrl: finalArtworkUrl,
      });
      const updated = response.data?.song as {
        id: string;
        title: string;
        stationId?: string;
        stationIds?: string[];
        artworkUrl?: string | null;
      };
      setSongs((prev) =>
        prev.map((song) =>
          song.id === editingSong.id
            ? {
                ...song,
                title: updated.title ?? title,
                station_id: updated.stationId ?? editStationIds[0],
                station_ids: updated.stationIds ?? editStationIds,
                artwork_url: updated.artworkUrl !== undefined ? updated.artworkUrl : finalArtworkUrl,
              }
            : song,
        ),
      );
      closeEditModal();
    } catch (err) {
      console.error('Failed to update song metadata:', err);
      alert('Failed to update song metadata');
      setEditSaving(false);
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
      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                filter === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        
        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search songs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* Sort Dropdown */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as [SortField, SortOrder];
              setSortBy(field);
              setSortOrder(order);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="title-asc">A-Z</option>
            <option value="title-desc">Z-A</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Songs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : songs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No songs found with status: {filter}
          </div>
        ) : (
          <table className="w-full min-w-[1100px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="text-left px-6 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-purple-600"
                  onClick={() => handleSort('title')}
                >
                  Song <SortIcon field="title" />
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Artist</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Duration</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Credits</th>
                <th 
                  className="text-left px-6 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-purple-600"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Free Rotation</th>
                <th 
                  className="text-left px-6 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-purple-600"
                  onClick={() => handleSort('created_at')}
                >
                  Submitted <SortIcon field="created_at" />
                </th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {songs.map((song) => (
                <tr key={song.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center mr-3">
                        <ArtworkImage
                          src={song.artwork_url}
                          alt={song.title}
                          className="w-10 h-10 rounded object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{song.title}</p>
                        {song.audio_url && (
                          <audio controls className="h-6 mt-1">
                            <source src={song.audio_url} type="audio/mpeg" />
                          </audio>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-gray-900">{song.artist_name}</p>
                      {song.users && (
                        <p className="text-xs text-gray-500">{song.users.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm font-mono">
                    {formatDuration(durationOverrides[song.id] ?? song.duration_seconds)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${
                      (song.credits_remaining || 0) > 0 ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {song.credits_remaining || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      song.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      song.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {song.status}
                    </span>
                    {song.status === 'rejected' && song.rejection_reason && (
                      <p className="text-xs text-red-600 mt-1 max-w-[150px] truncate" title={song.rejection_reason}>
                        {song.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {song.status === 'approved' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleFreeRotation(song)}
                          disabled={actionLoading === song.id}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            song.admin_free_rotation ? 'bg-purple-600' : 'bg-gray-200'
                          }`}
                          title={
                            song.admin_free_rotation ? 'In free rotation' : 'Not in free rotation'
                          }
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              song.admin_free_rotation ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        <span className="text-xs text-gray-500">
                          {song.paid_play_count || 0} plays
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm whitespace-nowrap">
                    {new Date(song.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openTrimModal(song)}
                        disabled={actionLoading === `trim:${song.id}`}
                        className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Trim
                      </button>
                      <button
                        onClick={() => openEditModal(song)}
                        disabled={editSaving && editingSong?.id === song.id}
                        className="px-3 py-1 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDeleteSong(song)}
                        disabled={actionLoading === `delete:${song.id}`}
                        className="px-3 py-1 bg-rose-700 text-white text-sm rounded hover:bg-rose-800 disabled:opacity-50"
                      >
                        {actionLoading === `delete:${song.id}` ? 'Deleting...' : 'Delete'}
                      </button>
                      {song.status === 'pending' && (
                        <>
                        <button
                          onClick={() => handleApprove(song.id)}
                          disabled={actionLoading === song.id}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openRejectModal(song.id)}
                          disabled={actionLoading === song.id}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Song</h3>
            <p className="text-gray-600 mb-4">
              Provide a reason for rejection (optional). The artist will be notified and have 48 hours to respond before the song is deleted.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Audio quality issues, copyright concerns, explicit content..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === rejectingId}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === rejectingId ? 'Rejecting...' : 'Reject Song'}
              </button>
            </div>
          </div>
        </div>
      )}

      {trimmingSong && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Trim Song</h3>
            <p className="text-gray-600 mb-4">
              Drag the handles to cut the section you want to keep. A new trimmed audio file will be generated and saved.
            </p>
            <div className="rounded-lg border border-gray-200 p-4 mb-4">
              <div className="flex justify-between text-sm text-gray-700 mb-2">
                <span>Start: <span className="font-mono">{formatDuration(trimStartSeconds)}</span></span>
                <span>End: <span className="font-mono">{formatDuration(trimEndSeconds)}</span></span>
                <span>Keep: <span className="font-mono">{formatDuration(Math.max(1, trimEndSeconds - trimStartSeconds))}</span></span>
              </div>
              <div className="relative h-10">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gray-200" />
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-indigo-500"
                  style={{
                    left: `${(trimStartSeconds / getTrimTotalSeconds(trimmingSong)) * 100}%`,
                    right: `${100 - (trimEndSeconds / getTrimTotalSeconds(trimmingSong)) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={getTrimTotalSeconds(trimmingSong)}
                  step={1}
                  value={trimStartSeconds}
                  onChange={(e) => handleTrimStartDrag(Number(e.target.value))}
                  className="absolute inset-0 w-full bg-transparent pointer-events-auto z-10"
                />
                <input
                  type="range"
                  min={0}
                  max={getTrimTotalSeconds(trimmingSong)}
                  step={1}
                  value={trimEndSeconds}
                  onChange={(e) => handleTrimEndDrag(Number(e.target.value))}
                  className="absolute inset-0 w-full bg-transparent pointer-events-auto z-20"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0:00</span>
                <span>{formatDuration(getTrimTotalSeconds(trimmingSong))}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Start (s)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={trimStartSeconds}
                  onChange={(e) => handleTrimStartDrag(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">End (s)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={trimEndSeconds}
                  onChange={(e) => handleTrimEndDrag(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500"
                />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Current duration: {formatDuration(durationOverrides[trimmingSong.id] ?? trimmingSong.duration_seconds)}
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setTrimmingSong(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTrimSave}
                disabled={actionLoading === `trim:${trimmingSong.id}`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === `trim:${trimmingSong.id}` ? 'Saving...' : 'Trim & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSong && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Song Metadata</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Stations / Genres</label>
                <select
                  multiple
                  value={editStationIds}
                  onChange={(e) =>
                    setEditStationIds(
                      Array.from(e.target.selectedOptions).map((opt) => opt.value),
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 min-h-[150px]"
                >
                  {TOWERS.map((tower) => (
                    <option key={tower.id} value={tower.id}>
                      {tower.genre} (National)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Hold Ctrl/Cmd to select multiple stations.
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Album Cover URL</label>
                <input
                  type="text"
                  value={editArtworkUrl}
                  onChange={(e) => setEditArtworkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Or upload new cover</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(e) => setEditArtworkFile(e.target.files?.[0] ?? null)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveMetadata()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                disabled={editSaving}
              >
                {editSaving ? 'Saving...' : 'Save Metadata'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
