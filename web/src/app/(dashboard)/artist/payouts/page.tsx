'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { songSalesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ConnectStatus = {
  accountId: string | null;
  onboarded: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

export default function ArtistPayoutsPage() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await songSalesApi.connectStatus();
      setStatus(res.data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startOnboarding = async () => {
    setWorking(true);
    try {
      const res = await songSalesApi.connectOnboard();
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      toast.error('Could not start onboarding. Try again.');
    } catch {
      toast.error('Could not start onboarding. Try again.');
    } finally {
      setWorking(false);
    }
  };

  const openDashboard = async () => {
    setWorking(true);
    try {
      const res = await songSalesApi.connectLoginLink();
      if (res.data?.url) {
        window.open(res.data.url, '_blank', 'noopener');
      }
    } catch {
      toast.error('Could not open your payouts dashboard.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Get paid when listeners buy your songs. Set up your payout account to
          start selling. Funds from each sale are transferred to you
          automatically (minus the platform fee).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading status…</p>
          ) : status?.onboarded ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">Ready to get paid</Badge>
                {status.chargesEnabled && (
                  <Badge variant="secondary">Sales enabled</Badge>
                )}
                {status.payoutsEnabled && (
                  <Badge variant="secondary">Payouts enabled</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Your account is connected. Listeners can buy your songs and
                you&apos;ll receive payouts to your bank.
              </p>
              <Button variant="outline" onClick={() => void openDashboard()} disabled={working}>
                Open payouts dashboard
              </Button>
            </>
          ) : status?.accountId && status.detailsSubmitted ? (
            <>
              <Badge variant="secondary">Under review</Badge>
              <p className="text-sm text-muted-foreground">
                Your details were submitted and Stripe is verifying your
                account. This can take a little while. You can finish any
                remaining steps below.
              </p>
              <Button onClick={() => void startOnboarding()} disabled={working}>
                {working ? 'Opening…' : 'Continue setup'}
              </Button>
            </>
          ) : (
            <>
              <Badge variant="outline">Not set up</Badge>
              <p className="text-sm text-muted-foreground">
                Connect a payout account (powered by Stripe) so you can sell
                your music and receive payments.
              </p>
              <Button onClick={() => void startOnboarding()} disabled={working}>
                {working ? 'Opening…' : 'Set up payouts'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
