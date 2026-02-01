'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { songsApi, creditsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
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
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to allocate credits');
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
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to withdraw credits');
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
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update setting');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!song) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Song not found</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => router.push('/artist/songs')}>← Back</Button>
        <h1 className="text-2xl font-bold text-foreground">Allocate Credits</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
        <div className="flex items-center space-x-4">
          {song.artworkUrl ? (
            <img
              src={song.artworkUrl}
              alt={song.title}
              className="w-20 h-20 rounded-lg object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-3xl">🎵</span>
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold text-foreground">{song.title}</h2>
            <p className="text-muted-foreground">{song.artistName}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Duration: {formatDuration(song.durationSeconds)} • 
              Credits per play: <span className="font-medium">{creditsPerPlay}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-primary/10 rounded-xl">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-primary">Current Allocation</p>
              <p className="text-2xl font-bold text-foreground">{song.creditsRemaining} credits</p>
              <p className="text-sm text-primary">~{calculatePlaysForBundle(song.creditsRemaining)} plays remaining</p>
            </div>
            {song.creditsRemaining > 0 && (
              <Button variant="outline" size="sm" onClick={handleWithdraw} disabled={submitting}>Withdraw All</Button>
            )}
          </div>
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">Your Credit Bank</h3>
          <p className="text-3xl font-bold text-foreground">{balance?.balance || 0} credits</p>
          <Button variant="link" className="p-0 h-auto mt-2" onClick={() => router.push('/artist/credits')}>
            Buy more credits →
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Select a Bundle</h3>
        
        <div className="space-y-3">
          {BUNDLES.map((bundle, index) => {
            const estimatedPlays = calculatePlaysForBundle(bundle.credits);
            const canAfford = balance && bundle.credits <= balance.balance;
            
            return (
              <label
                key={index}
                className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedBundle === index
                    ? 'border-primary bg-primary/10'
                    : canAfford
                    ? 'border-gray-200 hover:border-primary/50'
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
                    className="h-4 w-4 text-primary"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-foreground">
                      {bundle.label} / ~{estimatedPlays} play{estimatedPlays !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-500">{bundle.credits} credits</p>
                  </div>
                </div>
                {!canAfford && (
                  <span className="text-xs text-destructive">Insufficient credits</span>
                )}
              </label>
            );
          })}
        </div>

        <div className="mt-6 space-y-2">
          <Label>Or enter custom amount</Label>
          <div className="flex items-center space-x-3">
            <Input
              type="number"
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setSelectedBundle(null); }}
              placeholder="Enter credits"
              min={1}
            />
            <span className="text-muted-foreground">credits</span>
          </div>
          {customAmount && parseInt(customAmount, 10) > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">~{calculatePlaysForBundle(parseInt(customAmount, 10))} plays</p>
          )}
        </div>

        <Button onClick={handleAllocate} disabled={submitting || getAllocateAmount() <= 0} className="mt-6 w-full">
          {submitting ? 'Allocating...' : `Allocate ${getAllocateAmount()} Credits`}
        </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Free Play Fallback</h3>
              <p className="text-sm text-muted-foreground mt-1">
                When your credits run out, opt-in to keep your song in rotation for free. This helps you get discovered even without credits.
              </p>
            </div>
            <Button onClick={handleOptInToggle} disabled={submitting} variant={optInFreePlay ? 'default' : 'secondary'}>
              {optInFreePlay ? 'Opted In' : 'Opt In'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
