'use client';

import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';

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
  
  // Rejection modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
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
    if (sortBy !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-purple-600 ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleToggleFreeRotation = async (song: Song) => {
    if (!song.opt_in_free_play) {
      alert('Artist has not opted into free play');
      return;
    }
    if ((song.paid_play_count || 0) < 1) {
      alert('Song must have at least 1 paid play');
      return;
    }

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

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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
        
        <div className="flex gap-3 items-center">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search songs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : songs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No songs found with status: {filter}
          </div>
        ) : (
          <table className="w-full">
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
                    {formatDuration(song.duration_seconds)}
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
                          } ${(!song.opt_in_free_play || (song.paid_play_count || 0) < 1) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={
                            !song.opt_in_free_play ? 'Artist has not opted in' :
                            (song.paid_play_count || 0) < 1 ? 'No paid plays yet' :
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
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {new Date(song.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {song.status === 'pending' && (
                      <div className="flex justify-end gap-2">
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
                      </div>
                    )}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
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
    </div>
  );
}
