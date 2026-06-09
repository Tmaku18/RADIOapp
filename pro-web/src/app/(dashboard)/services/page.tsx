'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search as SearchIcon } from 'lucide-react';
import { proNetworxApi, type ProServiceListing } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const PAGE_SIZE = 24;

function formatPrice(cents: number | null, currency: string, rateType: 'hourly' | 'fixed'): string {
  if (!cents || cents <= 0) return 'Contact for pricing';
  const dollars = (cents / 100).toFixed(2);
  const symbol = currency.toUpperCase() === 'USD' ? '$' : `${currency} `;
  return `${symbol}${dollars}${rateType === 'hourly' ? '/hr' : ''}`;
}

export default function ServicesPage() {
  const { profile } = useAuth();
  const canList = profile?.role === 'artist' || profile?.role === 'service_provider' || profile?.role === 'admin';
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ProServiceListing[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (append: boolean, currentOffset: number) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await proNetworxApi.listServices({
          search: query.trim() || undefined,
          limit: PAGE_SIZE,
          offset: currentOffset,
        });
        const data = res.data;
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
      } catch (e) {
        console.error('Failed to load services:', e);
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query],
  );

  useEffect(() => {
    setOffset(0);
    void fetchPage(false, 0);
  }, [fetchPage]);

  const canLoadMore = items.length < total;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground">Hire creators directly.</p>
        </div>
        {canList && (
          <Button asChild>
            <Link href="/me/services">List a service</Link>
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link key={item.id} href={`/services/${item.id}`}>
              <Card className="p-4 h-full hover:bg-muted/30 transition-colors">
                <p className="text-xs uppercase text-muted-foreground">{item.serviceType.replace(/_/g, ' ')}</p>
                <h2 className="font-semibold mt-1">{item.title}</h2>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {item.description || 'No description'}
                </p>
                <p className="text-sm font-medium mt-3">
                  {formatPrice(item.priceCents, item.currency, item.rateType)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.ownerDisplayName || 'Creator'}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {canLoadMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={() => {
              const next = offset + PAGE_SIZE;
              setOffset(next);
              void fetchPage(true, next);
            }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
