'use client';

import { useState } from 'react';

interface RoleSelectionModalProps {
  onSelect: (role: 'listener' | 'artist') => void;
  onCancel: () => void;
  loading?: boolean;
}

export function RoleSelectionModal({ onSelect, onCancel, loading }: RoleSelectionModalProps) {
  const [selectedRole, setSelectedRole] = useState<'listener' | 'artist' | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      onSelect(selectedRole);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Welcome! Choose Your Role</h2>
          <p className="text-purple-100 text-sm mt-1">
            How would you like to use RadioApp?
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Listener Option */}
          <button
            onClick={() => setSelectedRole('listener')}
            disabled={loading}
            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
              selectedRole === 'listener'
                ? 'border-purple-600 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">🎧</div>
              <div>
                <h3 className="font-semibold text-gray-900">Listener</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Discover new music, like tracks, and chat with the community
                </p>
              </div>
              {selectedRole === 'listener' && (
                <div className="ml-auto text-purple-600">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </button>

          {/* Artist Option */}
          <button
            onClick={() => setSelectedRole('artist')}
            disabled={loading}
            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
              selectedRole === 'artist'
                ? 'border-purple-600 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">🎤</div>
              <div>
                <h3 className="font-semibold text-gray-900">Artist</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Upload your music, purchase airtime, and grow your audience
                </p>
              </div>
              {selectedRole === 'artist' && (
                <div className="ml-auto text-purple-600">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </button>

          <p className="text-xs text-gray-500 text-center">
            Listeners can upgrade to artists later from their profile settings.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedRole || loading}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
