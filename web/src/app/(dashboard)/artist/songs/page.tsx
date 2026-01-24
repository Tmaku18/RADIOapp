'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { songsApi } from '@/lib/api';

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
  optInFreePlay: boolean;
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

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

export default function MySongsPage() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      setLoading(true);
      const response = await songsApi.getMine();
      setSongs(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const calculateCreditsPerPlay = (durationSeconds?: number): number => {
    return Math.ceil((durationSeconds || 180) / 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Songs</h1>
          <p className="text-gray-600 mt-1">Manage your uploaded songs and allocate credits</p>
        </div>
        <button
          onClick={() => router.push('/artist/upload')}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Upload New Song
        </button>
      </div>

      {songs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">🎵</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No songs yet</h3>
          <p className="text-gray-600 mb-6">Upload your first song to start promoting your music!</p>
          <button
            onClick={() => router.push('/artist/upload')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Upload Your First Song
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plays
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {songs.map((song) => (
                <tr key={song.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        {song.artworkUrl ? (
                          <img
                            className="h-10 w-10 rounded-lg object-cover"
                            src={song.artworkUrl}
                            alt={song.title}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <span className="text-purple-600">🎵</span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{song.title}</div>
                        <div className="text-sm text-gray-500">{song.artistName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(song.status)}`}>
                      {song.status === 'pending' ? 'Awaiting Review' : song.status.charAt(0).toUpperCase() + song.status.slice(1)}
                    </span>
                    {song.status === 'rejected' && song.rejectionReason && (
                      <div className="text-xs text-red-600 mt-1" title={song.rejectionReason}>
                        {song.rejectionReason.substring(0, 30)}...
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDuration(song.durationSeconds)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{song.creditsRemaining} credits</div>
                    <div className="text-xs text-gray-500">
                      {calculateCreditsPerPlay(song.durationSeconds)} per play
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{song.playCount}</div>
                    <div className="text-xs text-gray-500">{song.likeCount} likes</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {song.status === 'approved' ? (
                      <button
                        onClick={() => router.push(`/artist/songs/${song.id}/allocate`)}
                        className="text-purple-600 hover:text-purple-900 font-medium"
                      >
                        Allocate Credits
                      </button>
                    ) : song.status === 'pending' ? (
                      <span className="text-gray-400">Pending review</span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
