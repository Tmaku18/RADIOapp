'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { creditsApi } from '@/lib/api';

interface DashboardStats {
  credits?: {
    balance: number;
    totalPurchased: number;
    totalUsed: number;
  };
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        // Only fetch credits for artists
        if (profile?.role === 'artist' || profile?.role === 'admin') {
          const creditsResponse = await creditsApi.getBalance();
          setStats({ credits: creditsResponse.data });
        }
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    if (profile) {
      loadStats();
    }
  }, [profile]);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back{profile?.displayName ? `, ${profile.displayName}` : ''}!
        </h1>
        <p className="text-purple-200">
          {profile?.role === 'artist'
            ? 'Ready to share your music with the world?'
            : profile?.role === 'admin'
            ? 'Manage the platform from your admin dashboard.'
            : 'Discover new music on RadioApp.'}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Listen Now */}
        <Link
          href="/listen"
          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="text-4xl mb-4">🎵</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Listen Now</h3>
          <p className="text-gray-600">
            Tune in to the radio and discover new underground artists.
          </p>
        </Link>

        {/* Artist-specific actions */}
        {(profile?.role === 'artist' || profile?.role === 'admin') && (
          <>
            <Link
              href="/artist/upload"
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
            >
              <div className="text-4xl mb-4">📤</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Music</h3>
              <p className="text-gray-600">
                Submit your tracks to the radio rotation.
              </p>
            </Link>

            <Link
              href="/artist/credits"
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
            >
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Buy Credits</h3>
              <p className="text-gray-600">
                Boost your tracks with play credits.
              </p>
            </Link>
          </>
        )}

        {/* Admin-specific actions */}
        {profile?.role === 'admin' && (
          <Link
            href="/admin"
            className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Panel</h3>
            <p className="text-gray-600">
              Manage songs, users, and platform settings.
            </p>
          </Link>
        )}

        {/* Profile */}
        <Link
          href="/profile"
          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="text-4xl mb-4">👤</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Profile</h3>
          <p className="text-gray-600">
            View and edit your profile information.
          </p>
        </Link>
      </div>

      {/* Stats Section for Artists */}
      {(profile?.role === 'artist' || profile?.role === 'admin') && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Stats</h2>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Credit Balance</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.credits?.balance || 0}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total Purchased</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.credits?.totalPurchased || 0}
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Credits Used</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.credits?.totalUsed || 0}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
