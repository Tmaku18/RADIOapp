'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { adminApi } from '../lib/api';
import type { Song } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function SongsPage() {
  const { getIdToken } = useAuth();
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get('status') as StatusFilter) || 'all';
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSongs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Fetch songs with optional status filter
      const filters: { status?: string; limit?: number } = { limit: 100 };
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      const data = await adminApi.getSongs(token, filters);
      setSongs(data.songs || []);
    } catch (err) {
      console.error('Failed to load songs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load songs');
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken, statusFilter]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const filteredSongs = statusFilter === 'all' 
    ? songs 
    : songs.filter(song => song.status === statusFilter);

  const handleUpdateStatus = async (songId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const token = await getIdToken();
      if (!token) return;

      await adminApi.updateSongStatus(token, songId, newStatus);
      
      // Update local state
      setSongs(songs => 
        songs.map(song => 
          song.id === songId ? { ...song, status: newStatus, updated_at: new Date().toISOString() } : song
        )
      );
    } catch (err) {
      console.error('Failed to update song status:', err);
      alert('Failed to update song status. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load songs</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadSongs}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Songs</h1>
          <p className="text-gray-500">Manage and moderate song submissions</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={loadSongs}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            🔄 Refresh
          </button>
          <div className="flex space-x-2">
            {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  statusFilter === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && (
                  <span className="ml-2 text-xs">
                    ({songs.filter(s => s.status === status).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Songs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Song
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Credits
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stats
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSongs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No songs found
                </td>
              </tr>
            ) : (
              filteredSongs.map((song) => (
                <tr key={song.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center mr-4">
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
                        <div className="text-sm font-medium text-gray-900">{song.title}</div>
                        <div className="text-sm text-gray-500">{song.artist_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(song.status)}`}>
                      {song.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {song.credits_remaining}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-4">
                      <span title="Plays">▶️ {song.play_count}</span>
                      <span title="Likes">❤️ {song.like_count}</span>
                      <span title="Skips">⏭️ {song.skip_count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(song.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {song.status === 'pending' && (
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleUpdateStatus(song.id, 'approved')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(song.id, 'rejected')}
                          className="text-red-600 hover:text-red-900"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {song.status === 'approved' && (
                      <button
                        onClick={() => handleUpdateStatus(song.id, 'rejected')}
                        className="text-red-600 hover:text-red-900"
                      >
                        Revoke
                      </button>
                    )}
                    {song.status === 'rejected' && (
                      <button
                        onClick={() => handleUpdateStatus(song.id, 'approved')}
                        className="text-green-600 hover:text-green-900"
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
