'use client';

import { useState, useEffect, useCallback } from 'react';
import StatsCard from './components/StatsCard';
import { adminApi } from './lib/api';
import type { Analytics, Song } from './lib/api';
import { useAuth } from './contexts/AuthContext';

export default function Dashboard() {
  const { getIdToken } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pendingSongs, setPendingSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Load analytics and pending songs in parallel
      const [analyticsData, songsData] = await Promise.all([
        adminApi.getAnalytics(token),
        adminApi.getSongs(token, { status: 'pending', limit: 5 }),
      ]);

      setAnalytics(analyticsData);
      setPendingSongs(songsData.songs || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (songId: string) => {
    try {
      const token = await getIdToken();
      if (!token) return;

      await adminApi.updateSongStatus(token, songId, 'approved');
      
      // Update local state
      setPendingSongs(songs => songs.filter(s => s.id !== songId));
      if (analytics) {
        setAnalytics({
          ...analytics,
          pendingSongs: analytics.pendingSongs - 1,
          approvedSongs: analytics.approvedSongs + 1,
        });
      }
    } catch (err) {
      console.error('Failed to approve song:', err);
      alert('Failed to approve song. Please try again.');
    }
  };

  const handleReject = async (songId: string) => {
    try {
      const token = await getIdToken();
      if (!token) return;

      await adminApi.updateSongStatus(token, songId, 'rejected');
      
      // Update local state
      setPendingSongs(songs => songs.filter(s => s.id !== songId));
      if (analytics) {
        setAnalytics({
          ...analytics,
          pendingSongs: analytics.pendingSongs - 1,
        });
      }
    } catch (err) {
      console.error('Failed to reject song:', err);
      alert('Failed to reject song. Please try again.');
    }
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load data</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadData}
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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome to the Radio App admin panel</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={analytics?.totalUsers || 0}
          icon="👥"
        />
        <StatsCard
          title="Gems"
          value={analytics?.totalArtists || 0}
          icon="🎤"
        />
        <StatsCard
          title="Total Songs"
          value={analytics?.totalSongs || 0}
          icon="🎵"
        />
        <StatsCard
          title="Discoveries"
          value={analytics?.totalPlays?.toLocaleString() || 0}
          icon="▶️"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Pending Approval"
          value={analytics?.pendingSongs || 0}
          icon="⏳"
          change="Requires attention"
          changeType={analytics?.pendingSongs && analytics.pendingSongs > 0 ? 'negative' : 'neutral'}
        />
        <StatsCard
          title="Approved Songs"
          value={analytics?.approvedSongs || 0}
          icon="✅"
        />
        <StatsCard
          title="Total Ripples"
          value={analytics?.totalLikes?.toLocaleString() || 0}
          icon="❤️"
        />
      </div>

      {/* Recent Pending Songs */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Songs Pending Approval</h2>
        </div>
        {pendingSongs.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No songs pending approval
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingSongs.map((song) => (
              <div key={song.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                    {song.artwork_url ? (
                      <img
                        src={song.artwork_url}
                        alt={song.title}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="text-2xl">🎵</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{song.title}</p>
                    <p className="text-sm text-gray-500">{song.artist_name}</p>
                    <p className="text-xs text-gray-400">
                      Submitted {new Date(song.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleApprove(song.id)}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(song.id)}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {pendingSongs.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <a
              href="/songs?status=pending"
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
            >
              View all pending songs →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
