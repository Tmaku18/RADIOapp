'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { paymentsApi, creditsApi } from '@/lib/api';
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
  placements?: number;
  exposures?: number;
  totalCents: number;
  totalDollars: string;
}

interface SongPlayPrice {
  songId: string;
  title: string;
  durationSeconds: number;
  exposuresPerPlacement?: number;
  pricePerPlacementDollars?: string;
  pricePerPlayCents: number;
  pricePerPlayDollars: string;
  options: PriceOption[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const PLACEMENT_OPTIONS = [1, 3, 5, 10, 25, 50, 100];

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
  const [welcomeRemaining, setWelcomeRemaining] = useState(0);
  const [welcomeLocked, setWelcomeLocked] = useState(false);
  const [welcomeAvailable, setWelcomeAvailable] = useState(false);
  const [welcomeToApply, setWelcomeToApply] = useState(1);
  const [welcomeNotice, setWelcomeNotice] = useState<string | null>(null);

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    if (songId) loadPrice();
  }, [songId]);

  const loadPrice = async () => {
    try {
      setLoading(true);
      setError(null);
      const [{ data }, balanceRes] = await Promise.all([
        paymentsApi.getSongPlayPrice(songId),
        creditsApi.getBalance().catch(() => null),
      ]);
      setPrice(data);
      setSelectedPlays(null);
      const bal = balanceRes?.data;
      if (bal) {
        const remaining = bal.welcomePlacementsRemaining ?? 0;
        setWelcomeRemaining(remaining);
        setWelcomeLocked(bal.welcomePlacementsLocked === true);
        setWelcomeAvailable(bal.welcomePlacementsAvailable === true);
        setWelcomeToApply(remaining > 0 ? 1 : 0);
      }
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load price'));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyWelcome = async () => {
    if (!welcomeAvailable || welcomeRemaining <= 0) return;
    const count = Math.min(Math.max(welcomeToApply, 1), welcomeRemaining);
    try {
      setSubmitting(true);
      setError(null);
      setWelcomeNotice(null);
      await creditsApi.applyWelcomePlacements(songId, count);
      const left = welcomeRemaining - count;
      if (left <= 0) {
        setWelcomeRemaining(0);
        setWelcomeAvailable(false);
        router.push(`/artist/songs?welcome_plays=applied`);
        return;
      }
      setWelcomeRemaining(left);
      setWelcomeToApply(1);
      setWelcomeNotice(
        `Applied ${count} free ${count === 1 ? 'play' : 'plays'} to this song. ` +
          `${left} left to split across your other songs.`,
      );
      await loadPrice();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not apply free plays'));
    } finally {
      setSubmitting(false);
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
          Back to My Songs
        </Button>
      </div>
    );
  }

  if (!price) return null;

  const selectedOption = price.options.find((o) => o.plays === selectedPlays);
  const exposuresPerPlacement = price.exposuresPerPlacement ?? 1000;
  const placementPriceDollars =
    price.pricePerPlacementDollars ?? price.pricePerPlayDollars;
  const exposuresFor = (option: PriceOption) =>
    option.exposures ?? option.plays * exposuresPerPlacement;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Button variant="ghost" onClick={() => router.push('/artist/songs')} className="mb-4">
          ← Back to My Songs
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Buy live listener placements</h1>
        <p className="text-muted-foreground mt-1">
          {price.title} · {formatDuration(price.durationSeconds)}
        </p>
      </div>

      {success && (
        <Alert>
          <AlertDescription>Payment successful. Your live listener placements have been added to this song.</AlertDescription>
        </Alert>
      )}
      {canceled && (
        <Alert variant="default">
          <AlertDescription>Checkout was canceled. You can try again when ready.</AlertDescription>
        </Alert>
      )}

      {welcomeRemaining > 0 && (
        <Card className="border-primary/40 bg-primary/[0.04]">
          <CardContent className="pt-6 space-y-3">
            <div>
              <p className="font-semibold text-foreground">
                {welcomeLocked
                  ? `You have ${welcomeRemaining} free Discovery plays`
                  : `Apply ${welcomeRemaining} free Discovery plays`}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {welcomeLocked
                  ? 'Gifted when you signed up as an artist or producer. They unlock when beta ends — we won’t use them yet.'
                  : 'Choose how many to send to this song and save the rest for your other uploads.'}
              </p>
            </div>
            {welcomeNotice && (
              <p className="text-sm text-foreground">{welcomeNotice}</p>
            )}
            {welcomeAvailable && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={submitting || welcomeToApply <= 1}
                    onClick={() => setWelcomeToApply((n) => Math.max(1, n - 1))}
                  >
                    −
                  </Button>
                  <span className="w-8 text-center font-semibold text-foreground">
                    {welcomeToApply}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={submitting || welcomeToApply >= welcomeRemaining}
                    onClick={() =>
                      setWelcomeToApply((n) => Math.min(welcomeRemaining, n + 1))
                    }
                  >
                    +
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={submitting || welcomeToApply === welcomeRemaining}
                    onClick={() => setWelcomeToApply(welcomeRemaining)}
                  >
                    All {welcomeRemaining}
                  </Button>
                </div>
                <Button onClick={handleApplyWelcome} disabled={submitting}>
                  {submitting
                    ? 'Applying…'
                    : `Apply ${welcomeToApply} free ${welcomeToApply === 1 ? 'play' : 'plays'}`}
                </Button>
                <span className="text-xs text-muted-foreground">
                  ~{(welcomeToApply * exposuresPerPlacement).toLocaleString()} exposures
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-1">Price per placement</p>
          <p className="text-2xl font-semibold text-foreground">${placementPriceDollars} <span className="text-base font-normal text-muted-foreground">/ placement</span></p>
          <p className="text-xs text-muted-foreground mt-1">Flat $1.99 per placement · targets ~{exposuresPerPlacement.toLocaleString()} verified listener exposures</p>

          <div className="mt-6">
            <p className="text-sm font-medium text-foreground mb-3">Choose number of placements</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PLACEMENT_OPTIONS.map((placements) => {
                const option = price.options.find((o) => o.plays === placements);
                if (!option) return null;
                const isSelected = selectedPlays === placements;
                return (
                  <button
                    key={placements}
                    type="button"
                    onClick={() => setSelectedPlays(placements)}
                    className={cn(
                      'rounded-lg border-2 p-4 text-left transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-muted-foreground/50',
                    )}
                  >
                    <div className="font-medium text-foreground">{placements} {placements === 1 ? 'placement' : 'placements'}</div>
                    <div className="text-xs text-muted-foreground">~{exposuresFor(option).toLocaleString()} exposures</div>
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
                  Total: <span className="font-semibold text-foreground">${selectedOption.totalDollars}</span> for {selectedPlays} {selectedPlays === 1 ? 'placement' : 'placements'} · ~{exposuresFor(selectedOption).toLocaleString()} exposures
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
