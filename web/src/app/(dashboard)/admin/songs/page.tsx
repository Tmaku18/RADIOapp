'use client';

import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';

interface Song {
  id: string;
  title: string;
  artist_name: string;
  artwork_url: string | null;
  audio_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function AdminSongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadSongs();
  }, [filter]);

  const loadSongs = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getSongs({
        status: filter === 'all' ? undefined : filter,
        limit: 50,
      });
      setSongs(response.data.songs || []);
    } catch (err) {
      console.error('Failed to load songs:', err);
      setError('Failed to load songs');
    } finally {
      setLoading(false);
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

  const handleReject = async (songId: string) => {
    setActionLoading(songId);
    try {
      await adminApi.updateSongStatus(songId, 'rejected');
      setSongs(songs.map(s => 
        s.id === songId ? { ...s, status: 'rejected' } : s
      ));
    } catch (err) {
      console.error('Failed to reject song:', err);
      alert('Failed to reject song');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-2">
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
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Song</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Artist</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Submitted</th>
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
                  <td className="px-6 py-4 text-gray-600">{song.artist_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      song.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      song.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {song.status}
                    </span>
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
                          onClick={() => handleReject(song.id)}
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
    </div>
  );
}
