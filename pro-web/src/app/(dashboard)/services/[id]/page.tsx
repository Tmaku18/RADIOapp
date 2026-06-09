'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { proNetworxApi, type ProServiceListing } from '@/lib/api';
import { Button } from '@/components/ui/button';

function formatPrice(cents: number | null, currency: string, rateType: 'hourly' | 'fixed'): string {
  if (!cents || cents <= 0) return 'Contact for pricing';
  const dollars = (cents / 100).toFixed(2);
  const symbol = currency.toUpperCase() === 'USD' ? '$' : `${currency} `;
  return `${symbol}${dollars}${rateType === 'hourly' ? '/hr' : ''}`;
}

export default function ServiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [item, setItem] = useState<ProServiceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await proNetworxApi.getService(id);
        setItem(res.data);
      } catch {
        setError('Service not found.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">{error ?? 'Not found'}</p>
        <Button asChild variant="outline"><Link href="/services">Back to services</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Button variant="ghost" asChild><Link href="/services">← Services</Link></Button>
      <div className="space-y-2">
        <p className="text-xs uppercase text-muted-foreground">{item.serviceType.replace(/_/g, ' ')}</p>
        <h1 className="text-3xl font-semibold">{item.title}</h1>
        <p className="text-lg font-medium">{formatPrice(item.priceCents, item.currency, item.rateType)}</p>
      </div>
      <div className="flex items-center gap-3">
        {item.ownerAvatarUrl ? (
          <Image src={item.ownerAvatarUrl} alt="" width={44} height={44} className="rounded-full object-cover" unoptimized />
        ) : (
          <div className="w-11 h-11 rounded-full bg-muted" />
        )}
        <div>
          <Link href={`/u/${item.ownerUserId}`} className="font-medium hover:underline">
            {item.ownerDisplayName || 'Creator'}
          </Link>
          {item.ownerHeadline && <p className="text-sm text-muted-foreground">{item.ownerHeadline}</p>}
        </div>
      </div>
      {item.description && <p className="text-muted-foreground whitespace-pre-wrap">{item.description}</p>}
      <div className="rounded-lg border border-border p-4 space-y-2">
        <p className="font-medium">Contact</p>
        <p className="text-sm text-muted-foreground">
          Subscribe to PRO-NETWORX to reveal contact details, or message the creator from their profile.
        </p>
        <Button asChild><Link href={`/u/${item.ownerUserId}`}>View profile</Link></Button>
      </div>
    </div>
  );
}
