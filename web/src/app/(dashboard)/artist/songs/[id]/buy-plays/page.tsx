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
  bonusPlacements?: number;
  exposures?: number;
  totalCents: number;
  totalDollars: string;
}

function bonusPlacementsFor(paid: number): number {
  switch (paid) {
    case 3:
      return 1;
    case 5:
      return 2;
    case 10:
      return 4;
    case 25:
      return 10;
    case 50:
      return 20;
    case 100:
      return 40;
    default:
      return 0;
  }
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

/** Matches EXPOSURES_PER_PLACEMENT on the backend. */
const EXPOSURES_PER_PLACEMENT = 100;

/** Matches packPriceCents on the backend and the store SKUs. */
function packPriceCents(placements: number): number {
  switch (placements) {
    case 1:
      return 199;
    case 3:
      return 499;
    case 5:
      return 999;
    case 10:
      return 1799;
    case 25:
      return 3999;
    case 50:
      return 7599;
    case 100:
      return 15000;
    default:
      return placements * 199;
  }
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

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
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!songId) return;
    const returnedOk = searchParams.get('success') === 'true';
    const returnedCanceled = searchParams.get('canceled') === 'true';
    void (async () => {
      await loadPrice();
      if (returnedOk) {
        setCheckoutNotice(
          'Checkout completed. If the payment went through, placements will show on this song shortly.',
        );
      } else if (returnedCanceled) {
        setCheckoutNotice('Checkout was canceled. You can try again when ready.');
      }
      if (returnedOk || returnedCanceled) {
        router.replace(`/artist/songs/${songId}/buy-plays`);
      }
    })();
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
      const msg = errorMessage(err, 'Failed to load price');
      setError(
        msg.toLowerCase().includes('approved')
          ? 'This song has to be approved for rotation before you can buy placements or use your free Discovery plays on it.'
          : msg,
      );
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
      setWelcomeNotice(
        left > 0
          ? `Applied ${count} free ${count === 1 ? 'play' : 'plays'} to this song. ` +
              `${left} left to split across your other songs.`
          : `Applied ${count} free ${count === 1 ? 'play' : 'plays'} to this song — ` +
              'that was the last of your signup plays.',
      );
      setWelcomeRemaining(left);
      setWelcomeToApply(left > 0 ? 1 : 0);
      if (left <= 0) setWelcomeAvailable(false);
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
  const exposuresPerPlacement = EXPOSURES_PER_PLACEMENT;
  const placementPriceDollars = dollars(packPriceCents(1));
  const bonusFor = (option: PriceOption) => bonusPlacementsFor(option.plays);
  const exposuresFor = (option: PriceOption) =>
    (option.plays + bonusFor(option)) * exposuresPerPlacement;
  const totalFor = (option: PriceOption) => dollars(packPriceCents(option.plays));

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

      {checkoutNotice && (
        <Alert>
          <AlertDescription>{checkoutNotice}</AlertDescription>
        </Alert>
      )}

      {welcomeNotice && (
        <Alert>
          <AlertDescription>{welcomeNotice}</AlertDescription>
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
          <p className="text-sm text-muted-foreground mb-1">One placement</p>
          <p className="text-2xl font-semibold text-foreground">${placementPriceDollars}</p>
          <p className="text-xs text-muted-foreground mt-1">Each placement targets ~{exposuresPerPlacement.toLocaleString()} verified listener exposures. Packs: 3 for $4.99, 5 for $9.99, 10 for $17.99, 25 for $39.99, 50 for $75.99, 100 for $150. Those packs also include free placements.</p>

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
                    {bonusFor(option) > 0 && (
                      <div className="text-xs font-medium text-primary">+ {bonusFor(option)} free</div>
                    )}
                    <div className="text-xs text-muted-foreground">~{exposuresFor(option).toLocaleString()} exposures</div>
                    <div className="text-sm text-muted-foreground">${totalFor(option)}</div>
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
                  Total: <span className="font-semibold text-foreground">${totalFor(selectedOption)}</span> for {selectedPlays} {selectedPlays === 1 ? 'placement' : 'placements'}
                  {bonusFor(selectedOption) > 0 ? ` + ${bonusFor(selectedOption)} free` : ''} · ~{exposuresFor(selectedOption).toLocaleString()} exposures
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
