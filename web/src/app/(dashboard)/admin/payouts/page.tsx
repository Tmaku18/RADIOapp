'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

type Purchase = {
  id: string;
  songId: string | null;
  songTitle: string;
  amountCents: number;
  artistAmountCents: number;
  createdAt: string;
};

type ArtistPayout = {
  artistId: string;
  artistName: string;
  artistEmail: string | null;
  currency: string;
  owedCents: number;
  grossCents: number;
  purchaseCount: number;
  purchases: Purchase[];
};

type PayoutsData = {
  totalOwedCents: number;
  totalGrossCents: number;
  artistCount: number;
  purchaseCount: number;
  artists: ArtistPayout[];
};

function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format((cents || 0) / 100);
}

export default function AdminPayoutsPage() {
  const [data, setData] = useState<PayoutsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getPendingPayouts();
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load payouts.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (artistId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(artistId)) next.delete(artistId);
      else next.add(artistId);
      return next;
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to admin
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">
            Artist Payouts Owed
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Completed song purchases the platform collected because the artist
            hasn&apos;t finished Stripe Connect onboarding. Pay these out
            manually, then mark them settled.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6 text-red-400">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">
              Total Owed to Artists
            </div>
            <div className="text-3xl font-bold text-foreground mt-1">
              {money(data?.totalOwedCents ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">
              Artists Awaiting Payout
            </div>
            <div className="text-3xl font-bold text-foreground mt-1">
              {data?.artistCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">
              Gross Collected (pending)
            </div>
            <div className="text-3xl font-bold text-foreground mt-1">
              {money(data?.totalGrossCents ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading && !data ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : !data || data.artists.length === 0 ? (
            <p className="text-muted-foreground">
              No outstanding payouts. Every completed sale either paid the artist
              directly or has been settled.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artist</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.artists.map((a) => (
                  <Fragment key={a.artistId}>
                    <TableRow>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/users/${a.artistId}`}
                          className="hover:underline"
                        >
                          {a.artistName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.artistEmail ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.purchaseCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {money(a.owedCents, a.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggle(a.artistId)}
                        >
                          {expanded.has(a.artistId) ? 'Hide' : 'View'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded.has(a.artistId) &&
                      a.purchases.map((p) => (
                        <TableRow key={p.id} className="bg-muted/30">
                          <TableCell className="pl-8 text-sm text-muted-foreground">
                            {p.songTitle}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right text-sm">
                            {money(p.artistAmountCents, a.currency)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
