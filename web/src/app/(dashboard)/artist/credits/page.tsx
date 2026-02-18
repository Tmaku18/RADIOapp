'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { paymentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Transaction {
  id: string;
  amount_cents: number;
  credits_purchased?: number;
  song_id?: string | null;
  plays_purchased?: number | null;
  song_title?: string | null;
  status: string;
  created_at: string;
}

export default function CreditsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await paymentsApi.getTransactions();
      setTransactions((res.data as Transaction[]) || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setError('Failed to load transaction history');
    } finally {
      setLoading(false);
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
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Buy plays per song</h2>
          <p className="text-muted-foreground mb-4">
            Plays cost <strong className="text-foreground">$1 per minute per play</strong>, rounded up to the nearest cent.
            There is no credit bank — you buy plays for each approved song.
          </p>
          <p className="text-muted-foreground mb-2">
            Go to <strong className="text-foreground">My Songs</strong>, then click <strong className="text-foreground">Buy plays</strong> on an approved track to see price (based on song length) and choose 1, 3, 5, 10, 25, 50, or 100 plays.
          </p>
          <Button variant="default" asChild>
            <Link href="/artist/songs">Open My Songs →</Link>
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Transaction history</h2>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No transactions yet. Buy plays for an approved song from My Songs to get started.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((tx) => {
                const isPlayPurchase = tx.plays_purchased != null && tx.plays_purchased > 0;
                const description = isPlayPurchase
                  ? `${tx.plays_purchased} play${tx.plays_purchased === 1 ? '' : 's'}${tx.song_title ? ` · ${tx.song_title}` : ''}`
                  : `${tx.credits_purchased ?? 0} credits`;
                const amountCents = tx.amount_cents ?? 0;
                return (
                  <div key={tx.id} className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{description}</p>
                      <p className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">${(amountCents / 100).toFixed(2)}</p>
                      <Badge variant={tx.status === 'succeeded' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'} className="capitalize">{tx.status}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
