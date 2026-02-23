'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { prospectorApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

type YieldStatus = {
  balanceCents: number;
  tier: 'none' | 'copper' | 'silver' | 'gold' | 'diamond';
  oresRefinedCount: number;
};

function formatUsdFromCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export default function YieldPage() {
  const { profile } = useAuth();
  const isProspector = profile?.role === 'listener';

  const [status, setStatus] = useState<YieldStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const canRedeem10 = (status?.balanceCents ?? 0) >= 1000;
  const canRedeem25 = (status?.balanceCents ?? 0) >= 2500;

  const tierLabel = useMemo(() => {
    const t = status?.tier ?? 'none';
    if (t === 'none') return 'Unranked';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }, [status?.tier]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await prospectorApi.getYield();
      setStatus(res.data as YieldStatus);
    } catch {
      setError('Failed to load The Yield.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const redeem = async (amountCents: number, type: 'virtual_visa' | 'merch' | 'boost_credits') => {
    setIsRedeeming(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await prospectorApi.redeem({ amountCents, type });
      const newBalanceCents = res.data?.newBalanceCents;
      setSuccess(`Redemption submitted. New balance: ${formatUsdFromCents(typeof newBalanceCents === 'number' ? newBalanceCents : (status?.balanceCents ?? 0) - amountCents)}.`);
      await refresh();
    } catch (err: unknown) {
      const maybeAxios = err as { response?: { data?: { message?: unknown } } } | null;
      const message = maybeAxios?.response?.data?.message;
      setError(typeof message === 'string' ? message : 'Redemption failed.');
    } finally {
      setIsRedeeming(false);
    }
  };

  if (!isProspector) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>The Yield</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The Yield is only available to Prospectors.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">The Yield</h1>
        <p className="text-muted-foreground mt-1">Micro-accrual rewards for verified prospecting.</p>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Balance</div>
            <div className="text-4xl font-bold text-primary mt-1">
              {loading ? '—' : formatUsdFromCents(status?.balanceCents ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-2">Redeem at $10 / $25 thresholds.</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Tier</div>
            <div className="text-3xl font-bold text-foreground mt-1">{loading ? '—' : tierLabel}</div>
            <div className="text-xs text-muted-foreground mt-2">Based on ores refined.</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Ores refined</div>
            <div className="text-3xl font-bold text-foreground mt-1">{loading ? '—' : (status?.oresRefinedCount ?? 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-2">1 refinement (1–10) = 1 ore refined.</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Redeem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              disabled={loading || isRedeeming || !canRedeem10}
              onClick={() => redeem(1000, 'merch')}
            >
              Redeem $10 (Merch)
            </Button>
            <Button
              variant="outline"
              disabled={loading || isRedeeming || !canRedeem10}
              onClick={() => redeem(1000, 'boost_credits')}
            >
              Redeem $10 (Boost credits)
            </Button>
            <Button
              disabled={loading || isRedeeming || !canRedeem25}
              onClick={() => redeem(2500, 'virtual_visa')}
            >
              Redeem $25 (Virtual Visa)
            </Button>
          </div>

          {!loading && !canRedeem10 && (
            <p className="text-sm text-muted-foreground">
              Keep prospecting to reach the $10 threshold.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

