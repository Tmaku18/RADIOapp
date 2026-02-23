'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { paymentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type ApiError = { response?: { data?: { message?: string } } };

function errorMessage(err: unknown, fallback: string): string {
  const msg =
    err && typeof err === 'object'
      ? (err as ApiError).response?.data?.message
      : undefined;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface PriceOption {
  plays: number;
  totalCents: number;
  totalDollars: string;
}

interface SongPlayPrice {
  songId: string;
  title: string;
  durationSeconds: number;
  pricePerPlayCents: number;
  pricePerPlayDollars: string;
  options: PriceOption[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const PLAYS_OPTIONS = [1, 3, 5, 10, 25, 50, 100];

export default function BuyPlaysPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const songId = params.id as string;

  const [price, setPrice] = useState<SongPlayPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlays, setSelectedPlays] = useState<number | null>(null);

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    if (songId) loadPrice();
  }, [songId]);

  const loadPrice = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await paymentsApi.getSongPlayPrice(songId);
      setPrice(data);
      setSelectedPlays(null);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load price'));
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPlays || !price) return;
    try {
      setSubmitting(true);
      setError(null);
      const { data } = await paymentsApi.createCheckoutSessionSongPlays({ songId, plays: selectedPlays });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError('No checkout URL returned');
    } catch (err: unknown) {
      setError(errorMessage(err, 'Checkout failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error && !price) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/artist/songs')}>
          Back to My Ores
        </Button>
      </div>
    );
  }

  if (!price) return null;

  const selectedOption = price.options.find((o) => o.plays === selectedPlays);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Button variant="ghost" onClick={() => router.push('/artist/songs')} className="mb-4">
          ← Back to My Ores
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Buy plays</h1>
        <p className="text-muted-foreground mt-1">
          {price.title} · {formatDuration(price.durationSeconds)}
        </p>
      </div>

      {success && (
        <Alert>
          <AlertDescription>Payment successful. Plays have been added to this ore.</AlertDescription>
        </Alert>
      )}
      {canceled && (
        <Alert variant="default">
          <AlertDescription>Checkout was canceled. You can try again when ready.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-1">Price per play</p>
          <p className="text-2xl font-semibold text-foreground">${price.pricePerPlayDollars} <span className="text-base font-normal text-muted-foreground">/ play</span></p>
          <p className="text-xs text-muted-foreground mt-1">$1 per minute, rounded up to the nearest cent</p>

          <div className="mt-6">
            <p className="text-sm font-medium text-foreground mb-3">Choose number of plays</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PLAYS_OPTIONS.map((plays) => {
                const option = price.options.find((o) => o.plays === plays);
                if (!option) return null;
                const isSelected = selectedPlays === plays;
                return (
                  <button
                    key={plays}
                    type="button"
                    onClick={() => setSelectedPlays(plays)}
                    className={cn(
                      'rounded-lg border-2 p-4 text-left transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-muted-foreground/50',
                    )}
                  >
                    <div className="font-medium text-foreground">{plays} {plays === 1 ? 'play' : 'plays'}</div>
                    <div className="text-sm text-muted-foreground">${option.totalDollars}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              {selectedOption && (
                <p className="text-sm text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">${selectedOption.totalDollars}</span> for {selectedPlays} plays
                </p>
              )}
            </div>
            <Button
              onClick={handlePurchase}
              disabled={!selectedPlays || submitting}
            >
              {submitting ? 'Redirecting…' : 'Continue to payment'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
