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

type Props = {
  variant?: 'dm' | 'contact';
  className?: string;
  /** Optional caption shown beneath the title to localize the prompt. */
  caption?: string;
  /** Where to redirect after a successful checkout. Defaults to current page. */
  successPath?: string;
  cancelPath?: string;
  onAccessKnown?: (access: ProNetworkAccess | null) => void;
};

export function PaywallCard({
  variant = 'dm',
  className,
  caption,
  successPath,
  cancelPath,
  onAccessKnown,
}: Props) {
  const [access, setAccess] = useState<ProNetworkAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await paymentsApi.createProNetworxCheckoutSession({
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

  const title =
    variant === 'dm' ? 'Subscribe to send messages' : 'Subscribe to view contact info';
  const defaultCaption =
    variant === 'dm'
      ? 'Direct messaging unlocks with a Pro-Networx subscription. Cancel anytime.'
      : 'See email, phone, and direct booking links from any creator.';

  return (
    <Card className={`p-5 sm:p-6 border-primary/30 bg-primary/[0.04] ${className ?? ''}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/15 p-2 shrink-0">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{caption ?? defaultCaption}</p>
          <div className="mt-3 flex items-baseline flex-wrap gap-x-2 gap-y-1">
            <span className="text-muted-foreground text-sm line-through">
              {formatProNetworxPriceUsd(regular)}/mo
            </span>
            <span className="text-2xl font-semibold text-foreground">
              {formatProNetworxPriceUsd(intro)}
            </span>
            <span className="text-sm text-muted-foreground">first month, then {formatProNetworxPriceUsd(regular)}/mo</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Includes DMs, contact info reveal, posting, and Networks Radio.</span>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleCheckout} disabled={submitting || loading}>
              {submitting ? 'Redirecting…' : 'Subscribe'}
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
