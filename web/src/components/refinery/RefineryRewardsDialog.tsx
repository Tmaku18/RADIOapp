'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { prospectorApi } from '@/lib/api';
import { REFINERY_REVIEW_REWARD_CENTS } from '@/data/refinery-questions';

const REDEMPTION_TIERS = [
  { cents: 500, label: '$5 Visa gift card' },
  { cents: 1000, label: '$10 Visa gift card' },
  { cents: 2500, label: '$25 Visa gift card' },
] as const;

function safeRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function RefineryRewardsDialog({
  open,
  onOpenChange,
  balanceCents,
  totalReviews,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceCents: number;
  totalReviews: number;
  onChange?: () => void;
}) {
  const [redeeming, setRedeeming] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reviewsToNextTier = (() => {
    const next = REDEMPTION_TIERS.find((t) => t.cents > balanceCents);
    if (!next) return null;
    const needed = Math.ceil(
      (next.cents - balanceCents) / REFINERY_REVIEW_REWARD_CENTS,
    );
    return { tier: next, needed };
  })();

  const redeem = async (cents: number) => {
    setRedeeming(cents);
    setSuccess(null);
    setError(null);
    try {
      await prospectorApi.redeem({
        amountCents: cents,
        type: 'virtual_visa',
        requestId: safeRequestId(),
      });
      setSuccess(
        `Redemption submitted. We'll email your Visa gift card details soon.`,
      );
      onChange?.();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object'
          ? ((err as { response?: { data?: { message?: unknown } } }).response?.data
              ?.message as string | undefined)
          : undefined;
      setError(message ?? 'Redemption failed. Please try again.');
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refinery rewards</DialogTitle>
          <DialogDescription>
            Each completed review credits $
            {(REFINERY_REVIEW_REWARD_CENTS / 100).toFixed(2)} to your Yield
            balance. Cash out for Visa gift cards once you hit a tier.
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardContent className="pt-4 space-y-1">
            <p className="text-xs text-muted-foreground">Current balance</p>
            <p className="text-3xl font-bold">
              ${(balanceCents / 100).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalReviews} review{totalReviews === 1 ? '' : 's'} completed
            </p>
            {reviewsToNextTier && (
              <p className="text-xs text-primary mt-2">
                ~{reviewsToNextTier.needed} more review
                {reviewsToNextTier.needed === 1 ? '' : 's'} until{' '}
                {reviewsToNextTier.tier.label}.
              </p>
            )}
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

        <div className="space-y-2">
          {REDEMPTION_TIERS.map((tier) => {
            const canRedeem = balanceCents >= tier.cents;
            return (
              <div
                key={tier.cents}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <p className="font-medium">{tier.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Costs ${(tier.cents / 100).toFixed(2)} from your balance
                  </p>
                </div>
                <Button
                  disabled={!canRedeem || redeeming !== null}
                  onClick={() => void redeem(tier.cents)}
                >
                  {redeeming === tier.cents ? 'Redeeming…' : 'Redeem'}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Note: Refinery submissions cost artists $4.99 per song with a minimum
          of 100 reviews ($2.00 in reviewer rewards). The remainder funds
          payouts and platform operations.
        </p>
      </DialogContent>
    </Dialog>
  );
}
