'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { creditsApi, paymentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const creditPackages = [
  { credits: 100, price: 999, label: '100 Credits', description: '$9.99', minutes: '~8 min' },
  { credits: 300, price: 1999, label: '300 Credits', description: '$19.99', minutes: '~25 min' },
  { credits: 600, price: 3499, label: '600 Credits', description: '$34.99', minutes: '~50 min', popular: true },
  { credits: 1200, price: 5999, label: '1200 Credits', description: '$59.99', minutes: '~100 min' },
];

interface CreditBalance {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
}

interface Transaction {
  id: string;
  amount: number;
  credits_purchased: number;
  status: string;
  created_at: string;
}

export default function CreditsPage() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [balanceRes, transactionsRes] = await Promise.all([
        creditsApi.getBalance(),
        paymentsApi.getTransactions(),
      ]);
      setBalance(balanceRes.data);
      setTransactions(transactionsRes.data || []);
    } catch (err) {
      console.error('Failed to load credits data:', err);
      setError('Failed to load credit information');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: typeof creditPackages[0]) => {
    setPurchasing(pkg.credits);
    setError(null);

    try {
      // Create checkout session
      const response = await paymentsApi.createCheckoutSession({
        amount: pkg.price,
        credits: pkg.credits,
      });

      const { url } = response.data;

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      setError('Failed to start checkout. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="bg-primary text-primary-foreground border-0">
        <CardContent className="pt-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-medium text-primary-foreground/80 mb-2">Credit Bank</h2>
              <div className="text-5xl font-bold mb-4">{balance?.balance || 0}</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-primary-foreground/80">Total Purchased:</span> <span className="ml-2 font-medium">{balance?.totalPurchased || 0}</span></div>
                <div><span className="text-primary-foreground/80">Total Used:</span> <span className="ml-2 font-medium">{balance?.totalUsed || 0}</span></div>
              </div>
            </div>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/artist/songs">Allocate to Songs →</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-foreground mb-3">How Credits Work</h3>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Buy credits</strong> below to add them to your Credit Bank</li>
            <li><strong className="text-foreground">Allocate credits</strong> to specific songs via the &quot;My Songs&quot; page</li>
            <li><strong className="text-foreground">Songs with credits</strong> get priority in the radio rotation</li>
            <li><strong className="text-foreground">1 credit = 5 seconds</strong> of airtime (a 3-min song costs ~36 credits per play)</li>
          </ol>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Buy Credits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {creditPackages.map((pkg) => (
              <Card key={pkg.credits} className={pkg.popular ? 'relative ring-2 ring-primary' : ''}>
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge>BEST VALUE</Badge>
                  </div>
                )}
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-foreground">{pkg.credits}</div>
                  <div className="text-sm text-muted-foreground mb-1">credits</div>
                  <div className="text-xs text-primary font-medium mb-2">{pkg.minutes} airtime</div>
                  <div className="text-xl font-semibold text-foreground mb-4">{pkg.description}</div>
                  <Button onClick={() => handlePurchase(pkg)} disabled={purchasing !== null} className="w-full" variant={pkg.popular ? 'default' : 'secondary'}>
                    {purchasing === pkg.credits ? 'Processing...' : 'Buy'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center mt-6">
            Credits go to your Credit Bank. Allocate them to songs via &quot;My Songs&quot; to get radio airtime.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Transaction History</h2>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No transactions yet. Purchase credits to get started.</div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{tx.credits_purchased} Credits</p>
                    <p className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">${(tx.amount / 100).toFixed(2)}</p>
                    <Badge variant={tx.status === 'succeeded' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'} className="capitalize">{tx.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
