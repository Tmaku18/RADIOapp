'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Analytics {
  totalUsers: number;
  totalArtists: number;
  totalSongs: number;
  totalPlays: number;
  pendingSongs: number;
  approvedSongs: number;
  totalLikes: number;
}

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect non-admins
    if (profile && profile.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    loadAnalytics();
  }, [profile, router]);

  const loadAnalytics = async () => {
    try {
      const response = await adminApi.getAnalytics();
      setAnalytics(response.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <span className="text-3xl mr-3">👥</span>
            <div>
              <div className="text-sm text-gray-600">Total Users</div>
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.totalUsers?.toLocaleString() || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <span className="text-3xl mr-3">🎤</span>
            <div>
              <div className="text-sm text-gray-600">Artists</div>
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.totalArtists?.toLocaleString() || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <span className="text-3xl mr-3">🎵</span>
            <div>
              <div className="text-sm text-gray-600">Total Songs</div>
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.totalSongs?.toLocaleString() || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <span className="text-3xl mr-3">▶️</span>
            <div>
              <div className="text-sm text-gray-600">Total Plays</div>
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.totalPlays?.toLocaleString() || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/songs"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">⏳</span>
            {analytics?.pendingSongs && analytics.pendingSongs > 0 && (
              <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full">
                {analytics.pendingSongs} pending
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Song Moderation</h3>
          <p className="text-gray-600 text-sm mt-1">
            Review and approve submitted tracks
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="mb-4">
            <span className="text-3xl">👥</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          <p className="text-gray-600 text-sm mt-1">
            Manage users and their roles
          </p>
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <span className="text-3xl">📊</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
          <p className="text-gray-600 text-sm mt-1">
            Platform metrics and insights
          </p>
          <p className="text-purple-600 text-sm mt-2">Coming soon</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Content Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-sm text-yellow-600 font-medium">Pending Approval</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {analytics?.pendingSongs || 0}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Approved Songs</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {analytics?.approvedSongs || 0}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-sm text-red-600 font-medium">Total Likes</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {analytics?.totalLikes?.toLocaleString() || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
