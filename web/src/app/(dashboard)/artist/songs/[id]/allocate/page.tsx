'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { songsApi, creditsApi } from '@/lib/api';

interface Song {
  id: string;
  title: string;
  artistName: string;
  artworkUrl?: string;
  durationSeconds?: number;
  creditsRemaining: number;
  playCount: number;
  optInFreePlay: boolean;
}

interface CreditBalance {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
}

// Standard minute bundles (in credits = seconds / 5)
const BUNDLES = [
  { credits: 12, label: '1 min', minutes: 1 },
  { credits: 36, label: '3 min', minutes: 3 },
  { credits: 60, label: '5 min', minutes: 5 },
  { credits: 120, label: '10 min', minutes: 10 },
  { credits: 360, label: '30 min', minutes: 30 },
];

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function AllocatePage() {
  const router = useRouter();
  const params = useParams();
  const songId = params.id as string;

  const [song, setSong] = useState<Song | null>(null);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [selectedBundle, setSelectedBundle] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [optInFreePlay, setOptInFreePlay] = useState(false);

  useEffect(() => {
    loadData();
  }, [songId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [songsResponse, balanceResponse] = await Promise.all([
        songsApi.getMine(),
        creditsApi.getBalance(),
      ]);
      
      const foundSong = songsResponse.data.find((s: Song) => s.id === songId);
      if (!foundSong) {
        setError('Song not found');
        return;
      }
      
      setSong(foundSong);
      setBalance(balanceResponse.data);
      setOptInFreePlay(foundSong.optInFreePlay || false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const creditsPerPlay = song ? Math.ceil((song.durationSeconds || 180) / 5) : 0;

  const calculatePlaysForBundle = (bundleCredits: number): number => {
    if (creditsPerPlay === 0) return 0;
    return Math.floor(bundleCredits / creditsPerPlay);
  };

  const getAllocateAmount = (): number => {
    if (selectedBundle !== null) {
      return BUNDLES[selectedBundle].credits;
    }
    const custom = parseInt(customAmount, 10);
    return isNaN(custom) || custom <= 0 ? 0 : custom;
  };

  const handleAllocate = async () => {
    const amount = getAllocateAmount();
    if (amount <= 0) {
      setError('Please select a bundle or enter a valid amount');
      return;
    }
    if (balance && amount > balance.balance) {
      setError('Insufficient credits');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      
      await creditsApi.allocateToSong(songId, amount);
      
      setSuccess(`Successfully allocated ${amount} credits!`);
      await loadData();
      setSelectedBundle(null);
      setCustomAmount('');
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof (err.response as { data?: { message?: string } }).data?.message === 'string'
          ? (err.response as { data: { message: string } }).data.message
          : err instanceof Error
            ? err.message
            : 'Failed to allocate credits';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!song || song.creditsRemaining <= 0) {
      setError('No credits to withdraw');
      return;
    }

    const amount = song.creditsRemaining;

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      
      await creditsApi.withdrawFromSong(songId, amount);
      
      setSuccess(`Successfully withdrew ${amount} credits!`);
      await loadData();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof (err.response as { data?: { message?: string } }).data?.message === 'string'
          ? (err.response as { data: { message: string } }).data.message
          : err instanceof Error
            ? err.message
            : 'Failed to withdraw credits';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOptInToggle = async () => {
    try {
      setSubmitting(true);
      await songsApi.updateOptIn(songId, !optInFreePlay);
      setOptInFreePlay(!optInFreePlay);
      setSuccess(optInFreePlay ? 'Opted out of free play' : 'Opted in for free play');
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof (err.response as { data?: { message?: string } }).data?.message === 'string'
          ? (err.response as { data: { message: string } }).data.message
          : err instanceof Error
            ? err.message
            : 'Failed to update setting';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Song not found
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.push('/artist/songs')}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Allocate Credits</h1>
      </div>

      {/* Song Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          {song.artworkUrl ? (
            <img
              src={song.artworkUrl}
              alt={song.title}
              className="w-20 h-20 rounded-lg object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-purple-100 flex items-center justify-center">
              <span className="text-3xl">🎵</span>
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{song.title}</h2>
            <p className="text-gray-600">{song.artistName}</p>
            <p className="text-sm text-gray-500 mt-1">
              Duration: {formatDuration(song.durationSeconds)} • 
              Credits per play: <span className="font-medium">{creditsPerPlay}</span>
            </p>
          </div>
        </div>

        {/* Current allocation */}
        <div className="mt-6 p-4 bg-purple-50 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-purple-600">Current Allocation</p>
              <p className="text-2xl font-bold text-purple-900">{song.creditsRemaining} credits</p>
              <p className="text-sm text-purple-600">
                ~{calculatePlaysForBundle(song.creditsRemaining)} plays remaining
              </p>
            </div>
            {song.creditsRemaining > 0 && (
              <button
                onClick={handleWithdraw}
                disabled={submitting}
                className="px-4 py-2 text-sm text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-100 disabled:opacity-50"
              >
                Withdraw All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Credit Bank */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Credit Bank</h3>
        <p className="text-3xl font-bold text-gray-900">{balance?.balance || 0} credits</p>
        <button
          onClick={() => router.push('/artist/credits')}
          className="mt-2 text-sm text-purple-600 hover:text-purple-800"
        >
          Buy more credits →
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          {success}
        </div>
      )}

      {/* Bundle Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Bundle</h3>
        
        <div className="space-y-3">
          {BUNDLES.map((bundle, index) => {
            const estimatedPlays = calculatePlaysForBundle(bundle.credits);
            const canAfford = balance && bundle.credits <= balance.balance;
            
            return (
              <label
                key={index}
                className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedBundle === index
                    ? 'border-purple-500 bg-purple-50'
                    : canAfford
                    ? 'border-gray-200 hover:border-purple-300'
                    : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="bundle"
                    checked={selectedBundle === index}
                    onChange={() => {
                      if (canAfford) {
                        setSelectedBundle(index);
                        setCustomAmount('');
                      }
                    }}
                    disabled={!canAfford}
                    className="h-4 w-4 text-purple-600"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-gray-900">
                      {bundle.label} / ~{estimatedPlays} play{estimatedPlays !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-500">{bundle.credits} credits</p>
                  </div>
                </div>
                {!canAfford && (
                  <span className="text-xs text-red-500">Insufficient credits</span>
                )}
              </label>
            );
          })}
        </div>

        {/* Custom amount */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Or enter custom amount
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedBundle(null);
              }}
              placeholder="Enter credits"
              min="1"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <span className="text-gray-500">credits</span>
          </div>
          {customAmount && parseInt(customAmount, 10) > 0 && (
            <p className="mt-2 text-sm text-gray-500">
              ~{calculatePlaysForBundle(parseInt(customAmount, 10))} plays
            </p>
          )}
        </div>

        {/* Allocate Button */}
        <button
          onClick={handleAllocate}
          disabled={submitting || getAllocateAmount() <= 0}
          className="mt-6 w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Allocating...' : `Allocate ${getAllocateAmount()} Credits`}
        </button>
      </div>

      {/* Opt-in Free Play */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Free Play Fallback</h3>
            <p className="text-sm text-gray-600 mt-1">
              When your credits run out, opt-in to keep your song in rotation for free.
              This helps you get discovered even without credits.
            </p>
          </div>
          <button
            onClick={handleOptInToggle}
            disabled={submitting}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              optInFreePlay
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {optInFreePlay ? 'Opted In' : 'Opt In'}
          </button>
        </div>
      </div>
    </div>
  );
}
