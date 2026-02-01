'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

interface Song {
  id: string;
  title: string;
  status: string;
  duration_seconds: number;
  play_count: number;
  like_count: number;
  users?: {
    id: string;
    display_name: string | null;
    email: string;
  };
}

export default function AdminFallbackSongDatabasePage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      const response = await adminApi.getSongsInFreeRotation();
      setSongs(response.data.songs || []);
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to load songs:', err);
      setError('Failed to load song database');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToFallback = async (songId: string) => {
    setAddingId(songId);
    setError(null);
    try {
      await adminApi.addFallbackSongFromSong(songId);
      await loadSongs();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(msg || 'Failed to add song to fallback');
    } finally {
      setAddingId(null);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor((seconds || 0) / 60);
    const secs = (seconds || 0) % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Link
          href="/admin/fallback"
          className="text-primary hover:text-primary/90 text-sm"
        >
          ← Back to Fallback Playlist
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Song Database</h1>
        <p className="text-gray-600 mt-1">
          Songs opted in by both artist and admin for free rotation. Add any of these to the fallback playlist.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {songs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="text-4xl mb-4">🎵</div>
            <p>No songs in free rotation yet.</p>
            <p className="text-sm mt-2">
              Songs appear here when artists opt in and admins approve them on the Free Rotation page.
            </p>
            <Link
              href="/admin/free-rotation"
              className="inline-block mt-4 text-primary hover:text-primary/90"
            >
              Go to Free Rotation Management
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Song</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Artist</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Duration</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Plays</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {songs.map((song) => (
                <tr key={song.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{song.title}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {song.users?.display_name || song.users?.email || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm font-mono">
                    {formatDuration(song.duration_seconds)}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{song.play_count ?? 0}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleAddToFallback(song.id)}
                      disabled={addingId === song.id}
                      className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {addingId === song.id ? 'Adding...' : 'Add to Fallback'}
                    </button>
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
