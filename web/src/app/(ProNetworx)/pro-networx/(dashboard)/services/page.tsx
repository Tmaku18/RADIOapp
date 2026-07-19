'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search as SearchIcon, Plus } from 'lucide-react';
import { proNetworxApi, type ProServiceListing } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { hasArtistCapability } from '@/lib/roles';

const PAGE_SIZE = 24;

const SERVICE_TYPES = [
  { value: '', label: 'All' },
  { value: 'graphic_design', label: 'Graphic design' },
  { value: 'photography', label: 'Photography' },
  { value: 'videography', label: 'Videography' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'lyricist', label: 'Lyricist' },
  { value: 'beat_maker', label: 'Beat maker' },
  { value: 'mix_master', label: 'Mix & master' },
  { value: 'other', label: 'Other' },
];

function shouldUnoptimize(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

function formatPrice(cents: number | null, currency: string, rateType: 'hourly' | 'fixed'): string {
  if (!cents || cents <= 0) return 'Contact for pricing';
  const dollars = (cents / 100).toFixed(2);
  const symbol = currency.toUpperCase() === 'USD' ? '$' : `${currency} `;
  return `${symbol}${dollars}${rateType === 'hourly' ? '/hr' : ''}`;
}

export default function ProNetworxServicesPage() {
  const { profile } = useAuth();
  const canList = hasArtistCapability(profile?.role) || profile?.role === 'service_provider';
  const [query, setQuery] = useState('');
  const [serviceType, setServiceType] = useState('');
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
          serviceType: serviceType || undefined,
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
    [query, serviceType],
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
          <p className="text-sm text-muted-foreground">
            Hire creators directly. Subscribe to view contact info.
          </p>
        </div>
        {canList && (
          <Button asChild>
            <Link href="/pro-networx/me/services" className="inline-flex items-center gap-1">
              <Plus className="h-4 w-4" /> List a service
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services…"
            className="pl-9"
          />
        </div>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {SERVICE_TYPES.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          No services match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((listing) => (
            <ServiceCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {canLoadMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              const next = offset + PAGE_SIZE;
              setOffset(next);
              void fetchPage(true, next);
            }}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}

function ServiceCard({ listing }: { listing: ProServiceListing }) {
  return (
    <Card className="p-4 flex flex-col gap-3 h-full">
      <Link
        href={`/pro-networx/u/${listing.ownerUserId}`}
        className="flex items-center gap-3"
      >
        {listing.ownerAvatarUrl ? (
          <Image
            src={listing.ownerAvatarUrl}
            alt={listing.ownerDisplayName ?? 'Avatar'}
            width={36}
            height={36}
            className="rounded-full object-cover"
            unoptimized={shouldUnoptimize(listing.ownerAvatarUrl)}
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            🎨
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">
            {listing.ownerDisplayName || 'Creator'}
          </p>
          {listing.ownerHeadline && (
            <p className="text-xs text-muted-foreground truncate">{listing.ownerHeadline}</p>
          )}
        </div>
      </Link>
      <div>
        <h3 className="font-semibold text-foreground line-clamp-1">{listing.title}</h3>
        {listing.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
            {listing.description}
          </p>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-foreground">
          {formatPrice(listing.priceCents, listing.currency, listing.rateType)}
        </span>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/pro-networx/services/${listing.id}`}>View</Link>
        </Button>
      </div>
    </Card>
  );
}
