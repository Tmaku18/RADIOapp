'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { adminApi } from '../lib/api';
import type { Song } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'copyrighted';

function isCopyrightFlagged(song: Song): boolean {
  return song.copyright_status === 'flagged';
}

function copyrightMatchLabel(song: Song): string {
  const match = song.copyright_match;
  if (!match?.title) return 'Possible copyright match';
  const artists = match.artists?.length ? ` — ${match.artists.join(', ')}` : '';
  const score =
    typeof match.score === 'number' ? ` (${Math.round(match.score)}%)` : '';
  return `${match.title}${artists}${score}`;
}

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

      // Fetch songs with optional status / copyright filter
      const filters: {
        status?: string;
        copyrightStatus?: string;
        limit?: number;
      } = { limit: 100 };
      if (statusFilter === 'copyrighted') {
        filters.status = 'all';
        filters.copyrightStatus = 'flagged';
      } else if (statusFilter !== 'all') {
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

  const filteredSongs =
    statusFilter === 'copyrighted'
      ? songs.filter((song) => isCopyrightFlagged(song))
      : statusFilter === 'all'
        ? songs
        : songs.filter((song) => song.status === statusFilter);

  const handleUpdateStatus = async (songId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const token = await getIdToken();
      if (!token) return;

      let reason: string | undefined;
      if (newStatus === 'rejected') {
        const input = window.prompt(
          'Explain why this song is rejected (required). The artist and other admins will see this:',
        );
        reason = (input || '').trim();
        if (reason.length < 10) {
          alert('A detailed rejection reason is required (at least 10 characters).');
          return;
        }
      }

      await adminApi.updateSongStatus(token, songId, newStatus, reason);

      // Update local state. Clear rejection context when approving.
      setSongs(songs =>
        songs.map(song =>
          song.id === songId
            ? {
                ...song,
                status: newStatus,
                updated_at: new Date().toISOString(),
                ...(newStatus === 'approved'
                  ? { rejection_reason: null, rejected_at: null }
                  : { rejection_reason: reason ?? null, rejected_at: new Date().toISOString() }),
              }
            : song
        )
      );
    } catch (err) {
      console.error('Failed to update song status:', err);
      alert('Failed to update song status. Please try again.');
    }
  };

  // Approve a rejected song (manual override). Surfaces the copyright match
  // in the confirm prompt so the admin reviews before overriding an
  // automated copyright rejection.
  const handleApproveRejected = async (song: Song) => {
    const match = song.copyright_match;
    const matchLabel = match?.title
      ? `${match.title}${match.artists?.length ? ` by ${match.artists.join(', ')}` : ''}${
          typeof match.score === 'number' ? ` (${Math.round(match.score)}% match)` : ''
        }`
      : null;
    const confirmed = window.confirm(
      song.copyright_status === 'flagged'
        ? `"${song.title}" was auto-rejected for a possible copyright match${
            matchLabel ? `: ${matchLabel}` : ''
          }.\n\nApprove it anyway and publish it?`
        : `Approve "${song.title}" and override its rejection? It will be published.`,
    );
    if (!confirmed) return;
    await handleUpdateStatus(song.id, 'approved');
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
            {(
              ['all', 'pending', 'approved', 'rejected', 'copyrighted'] as StatusFilter[]
            ).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  statusFilter === status
                    ? status === 'copyrighted'
                      ? 'bg-red-600 text-white'
                      : 'bg-purple-600 text-white'
                    : status === 'copyrighted'
                      ? 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                {status === 'copyrighted'
                  ? 'Copyrighted'
                  : status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && status !== 'copyrighted' && (
                  <span className="ml-2 text-xs">
                    ({songs.filter((s) => s.status === status).length})
                  </span>
                )}
                {status === 'copyrighted' && (
                  <span className="ml-2 text-xs">
                    ({songs.filter((s) => isCopyrightFlagged(s)).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {statusFilter === 'copyrighted' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
          Songs auto-flagged for a copyright match. Review before keeping them
          approved.
        </div>
      )}

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
                Copyright
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
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  {statusFilter === 'copyrighted'
                    ? 'No copyright-flagged songs found'
                    : 'No songs found'}
                </td>
              </tr>
            ) : (
              filteredSongs.map((song) => (
                <tr
                  key={song.id}
                  className={
                    isCopyrightFlagged(song)
                      ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-600'
                      : 'hover:bg-gray-50'
                  }
                >
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
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">
                            {song.title}
                          </div>
                          {isCopyrightFlagged(song) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">
                              Copyrighted
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{song.artist_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(song.status)}`}>
                      {song.status}
                    </span>
                    {song.status === 'rejected' && song.rejection_reason && (
                      <p
                        className="text-xs text-red-600 mt-1 max-w-[200px] truncate"
                        title={song.rejection_reason}
                      >
                        {song.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isCopyrightFlagged(song) ? (
                      <div>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide bg-red-600 text-white">
                          Copyrighted
                        </span>
                        <p
                          className="text-xs text-red-800 mt-1 max-w-[220px] truncate font-medium"
                          title={copyrightMatchLabel(song)}
                        >
                          {copyrightMatchLabel(song)}
                        </p>
                      </div>
                    ) : song.copyright_status === 'checking' ? (
                      <span className="text-xs text-blue-700">Checking…</span>
                    ) : song.copyright_status === 'error' ? (
                      <span className="text-xs text-amber-800">Check error</span>
                    ) : song.copyright_status === 'clear' ? (
                      <span className="text-xs text-emerald-700">Clear</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
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
                        onClick={() => handleApproveRejected(song)}
                        className="text-green-600 hover:text-green-900"
                        title="Override the rejection and publish this song"
                      >
                        Approve anyway
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
