'use client';

import { useEffect, useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { paymentsApi, proRadioSubscriptionApi, type ProRadioAccess } from '@/lib/api';
import {
  formatProRadioPriceUsd,
  PRO_RADIO_INTRO_CENTS,
  PRO_RADIO_REGULAR_CENTS,
} from '@/data/pro-radio-pricing';
import {
  formatProBundlePriceUsd,
  PRO_BUNDLE_REGULAR_CENTS,
  PRO_BUNDLE_SAVINGS_CENTS,
  PRO_BOTH_SOLO_TOTAL_CENTS,
} from '@/data/pro-bundle-pricing';

type Props = {
  className?: string;
  caption?: string;
  successPath?: string;
  cancelPath?: string;
  onAccessKnown?: (access: ProRadioAccess | null) => void;
};

type Plan = 'solo' | 'bundle';

export function ProRadioPaywallCard({
  className,
  caption,
  successPath,
  cancelPath,
  onAccessKnown,
}: Props) {
  const [access, setAccess] = useState<ProRadioAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>('bundle');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await proRadioSubscriptionApi.getAccess();
        if (!alive) return;
        setAccess(res.data);
        onAccessKnown?.(res.data);
      } catch {
        if (!alive) return;
        setAccess(null);
        onAccessKnown?.(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [onAccessKnown]);

  const intro = access?.pricing?.introCents ?? PRO_RADIO_INTRO_CENTS;
  const regular = access?.pricing?.regularCents ?? PRO_RADIO_REGULAR_CENTS;

  const handleCheckout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const path =
        typeof window !== 'undefined' ? window.location.pathname : '/pro-radio';
      const res =
        plan === 'bundle'
          ? await paymentsApi.createProBundleCheckoutSession({
              successUrl: `${origin}${successPath ?? path}?pro_bundle=success`,
              cancelUrl: `${origin}${cancelPath ?? path}?pro_bundle=canceled`,
            })
          : await paymentsApi.createProRadioCheckoutSession({
              successUrl: `${origin}${successPath ?? path}?pro_radio=success`,
              cancelUrl: `${origin}${cancelPath ?? path}?pro_radio=canceled`,
            });
      const url = (res.data as { url?: string })?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      setError('Could not start checkout. Try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  const defaultCaption =
    'Stream full songs on demand, build playlists, and control skip, shuffle, and queue — separate from live Networks Radio.';

  return (
    <Card className={`p-5 sm:p-6 border-primary/30 bg-primary/[0.04] ${className ?? ''}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/15 p-2 shrink-0">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            Subscribe to Pro-Radio
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{caption ?? defaultCaption}</p>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => setPlan('bundle')}
              className={`w-full text-left rounded-lg border p-3 transition ${
                plan === 'bundle'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    Pro Bundle
                    <span className="text-[10px] uppercase tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                      Best value
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pro-Radio + Pro-Networx — save{' '}
                    {formatProBundlePriceUsd(PRO_BUNDLE_SAVINGS_CENTS)} vs{' '}
                    {formatProBundlePriceUsd(PRO_BOTH_SOLO_TOTAL_CENTS)}
                  </p>
                </div>
                <span className="font-bold text-sm shrink-0">
                  {formatProBundlePriceUsd(PRO_BUNDLE_REGULAR_CENTS)}/mo
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPlan('solo')}
              className={`w-full text-left rounded-lg border p-3 transition ${
                plan === 'solo'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">Pro-Radio only</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatProRadioPriceUsd(intro)} first month, then{' '}
                    {formatProRadioPriceUsd(regular)}/mo
                  </p>
                </div>
                <span className="font-bold text-sm shrink-0">
                  {formatProRadioPriceUsd(PRO_RADIO_REGULAR_CENTS)}/mo
                </span>
              </div>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Full tracks from opted-in artists. Live radio stays unchanged.</span>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleCheckout} disabled={submitting || loading}>
              {submitting
                ? 'Redirecting…'
                : plan === 'bundle'
                  ? 'Get Pro Bundle'
                  : 'Subscribe'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
