'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  // Sync local displayName state when profile changes (e.g., after refreshProfile)
  useEffect(() => {
    if (!isEditing && profile?.displayName !== undefined) {
      setDisplayName(profile.displayName || '');
    }
  }, [profile?.displayName, isEditing]);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setIsSaving(true);

    try {
      await usersApi.updateMe({ displayName });
      await refreshProfile();
      setIsEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(profile?.displayName || '');
    setIsEditing(false);
    setError(null);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleUpgradeToArtist = async () => {
    setError(null);
    setIsUpgrading(true);

    try {
      await usersApi.upgradeToArtist();
      await refreshProfile();
      setUpgradeSuccess(true);
      // Redirect to artist dashboard after short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade account');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>
          <p className="text-gray-600 mt-1">Manage your account information</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              Profile updated successfully!
            </div>
          )}

          {/* Avatar */}
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <span className="text-4xl">👤</span>
              )}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                {profile?.displayName || 'No name set'}
              </h3>
              <p className="text-sm text-gray-500 capitalize">{profile?.role}</p>
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Email cannot be changed
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your display name"
              />
            ) : (
              <input
                type="text"
                value={profile?.displayName || 'Not set'}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            )}
          </div>

          {/* Role (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Type
            </label>
            <input
              type="text"
              value={profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
            {profile?.role === 'listener' && (
              <p className="text-xs text-gray-500 mt-1">
                Want to share your music? Upgrade to an artist account below.
              </p>
            )}
          </div>

          {/* Member Since */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Member Since
            </label>
            <input
              type="text"
              value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Upgrade to Artist Section - Only for Listeners */}
      {profile?.role === 'listener' && (
        <div className="mt-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl shadow-sm border border-purple-200">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🎤</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Become an Artist
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Upgrade your account to share your music with the world. As an artist, you can upload tracks, 
                  purchase airtime credits, and get your music on the radio.
                </p>

                {upgradeSuccess ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                    Congratulations! Your account has been upgraded to Artist. Redirecting to dashboard...
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleUpgradeToArtist}
                      disabled={isUpgrading}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                        isUpgrading
                          ? 'bg-purple-400 text-white cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {isUpgrading ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Upgrading...
                        </span>
                      ) : (
                        'Upgrade to Artist'
                      )}
                    </button>
                    <span className="text-sm text-gray-500">Free to upgrade</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out Section */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sign Out</h3>
          <p className="text-gray-600 text-sm mb-4">
            Sign out of your account on this device.
          </p>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className={`px-6 py-2 rounded-lg transition-colors ${
              isSigningOut
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
}
