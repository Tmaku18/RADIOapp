'use client';

import { useEffect, useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  paymentsApi,
  proNetworkSubscriptionApi,
  type ProNetworkAccess,
} from '@/lib/api';
import {
  formatProNetworxPriceUsd,
  PRO_NETWORX_INTRO_CENTS,
  PRO_NETWORX_REGULAR_CENTS,
} from '@/data/pro-networx-pricing';
import {
  formatProBundlePriceUsd,
  PRO_BUNDLE_REGULAR_CENTS,
  PRO_BUNDLE_SAVINGS_CENTS,
  PRO_BOTH_SOLO_TOTAL_CENTS,
} from '@/data/pro-bundle-pricing';

type Props = {
  variant?: 'dm' | 'contact';
  className?: string;
  /** Optional caption shown beneath the title to localize the prompt. */
  caption?: string;
  /**
   * Soft promo mode: messaging (or the feature) is already unlocked, but we
   * still promote the subscription price. Used during beta free messaging.
   */
  softPromo?: boolean;
  /** Where to redirect after a successful checkout. Defaults to current page. */
  successPath?: string;
  cancelPath?: string;
  onAccessKnown?: (access: ProNetworkAccess | null) => void;
};

type Plan = 'solo' | 'bundle';

export function PaywallCard({
  variant = 'dm',
  className,
  caption,
  softPromo = false,
  successPath,
  cancelPath,
  onAccessKnown,
}: Props) {
  const [access, setAccess] = useState<ProNetworkAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>('bundle');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await proNetworkSubscriptionApi.getAccess();
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

  const intro = access?.pricing?.introCents ?? PRO_NETWORX_INTRO_CENTS;
  const regular = access?.pricing?.regularCents ?? PRO_NETWORX_REGULAR_CENTS;

  const handleCheckout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const path = typeof window !== 'undefined' ? window.location.pathname : '/pro-networx/home';
      const res =
        plan === 'bundle'
          ? await paymentsApi.createProBundleCheckoutSession({
              successUrl: `${origin}${successPath ?? path}?pro_bundle=success`,
              cancelUrl: `${origin}${cancelPath ?? path}?pro_bundle=canceled`,
            })
          : await paymentsApi.createProNetworxCheckoutSession({
              successUrl: `${origin}${successPath ?? path}?pn_sub=success`,
              cancelUrl: `${origin}${cancelPath ?? path}?pn_sub=cancel`,
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

  const title = softPromo
    ? 'Messaging is free during beta'
    : variant === 'dm'
      ? 'Subscribe to send messages'
      : 'Subscribe to view contact info';
  const defaultCaption = softPromo
    ? `Pro-Networx is ${formatProNetworxPriceUsd(intro)} first month, then ${formatProNetworxPriceUsd(regular)}/mo — or get both Pros for ${formatProBundlePriceUsd(PRO_BUNDLE_REGULAR_CENTS)}/mo.`
    : variant === 'dm'
      ? 'Direct messaging unlocks with a Pro-Networx subscription. Cancel anytime.'
      : 'See email, phone, and direct booking links from any creator.';

  return (
    <Card className={`p-5 sm:p-6 border-primary/30 bg-primary/[0.04] ${className ?? ''}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/15 p-2 shrink-0">
          {softPromo ? (
            <Sparkles className="h-5 w-5 text-primary" />
          ) : (
            <Lock className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
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
                  <div className="font-semibold text-sm">Pro-Networx only</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatProNetworxPriceUsd(intro)} first month, then{' '}
                    {formatProNetworxPriceUsd(regular)}/mo
                  </p>
                </div>
                <span className="font-bold text-sm shrink-0">
                  {formatProNetworxPriceUsd(PRO_NETWORX_REGULAR_CENTS)}/mo
                </span>
              </div>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>
              {softPromo
                ? 'Subscribe anytime to keep access after beta and unlock the full membership.'
                : 'Includes DMs, contact info reveal, posting, and Networks Radio.'}
            </span>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleCheckout} disabled={submitting || loading}>
              {submitting
                ? 'Redirecting…'
                : softPromo
                  ? plan === 'bundle'
                    ? `See Pro Bundle — ${formatProBundlePriceUsd(PRO_BUNDLE_REGULAR_CENTS)}/mo`
                    : `See membership — ${formatProNetworxPriceUsd(intro)} first month`
                  : plan === 'bundle'
                    ? 'Get Pro Bundle'
                    : 'Subscribe'}
            </Button>
            <Button variant="outline" asChild>
              <a href="/pro-networx">Learn more</a>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export const DmPaywallCard = (
  props: Omit<Props, 'variant'>,
) => <PaywallCard {...props} variant="dm" />;

export const ContactInfoLockedCard = (
  props: Omit<Props, 'variant'>,
) => <PaywallCard {...props} variant="contact" />;
