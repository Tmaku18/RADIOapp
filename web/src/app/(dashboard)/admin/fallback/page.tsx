'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/api';

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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
          <Link
            href="/admin/fallback/upload"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Upload Song
          </Link>
          <Link
            href="/admin/fallback/song-database"
            className="bg-white text-purple-600 border border-purple-600 px-4 py-2 rounded-lg hover:bg-purple-50 transition-colors"
          >
            View Song Database
          </Link>
        </div>
      </div>

      {uploadSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          Song uploaded successfully.
          <button onClick={() => setUploadSuccess(false)} className="ml-2 text-green-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Songs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {songs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="text-4xl mb-4">🎵</div>
            <p>No fallback songs yet.</p>
            <p className="text-sm mt-2">Add royalty-free or licensed music for when no paid content is available.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Song</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Artist</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Duration</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {songs.map((song) => (
                <tr key={song.id} className={`hover:bg-gray-50 ${!song.is_active ? 'opacity-50' : ''}`}>
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
                  <td className="px-6 py-4 text-gray-600 text-sm font-mono">
                    {formatDuration(song.duration_seconds)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      song.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {song.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleToggleActive(song.id, song.is_active)}
                        disabled={actionLoading === song.id}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          song.is_active
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        } disabled:opacity-50`}
                      >
                        {song.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(song.id)}
                        disabled={actionLoading === song.id}
                        className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 disabled:opacity-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
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
