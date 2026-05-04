'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Mail, Phone, Link as LinkIcon, MessageSquare } from 'lucide-react';
import { proNetworxApi, type ProServiceListing } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ContactInfoLockedCard } from '@/components/pro-networx/PaywallCard';
import { useAuth } from '@/contexts/AuthContext';

function shouldUnoptimize(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

function formatPrice(cents: number | null, currency: string, rateType: 'hourly' | 'fixed'): string {
  if (!cents || cents <= 0) return 'Contact for pricing';
  const dollars = (cents / 100).toFixed(2);
  const symbol = currency.toUpperCase() === 'USD' ? '$' : `${currency} `;
  return `${symbol}${dollars}${rateType === 'hourly' ? '/hr' : ''}`;
}

export default function ProNetworxServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const [listing, setListing] = useState<ProServiceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await proNetworxApi.getService(id);
        if (!alive) return;
        setListing(res.data);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Failed to load service.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
          <Link href="/pro-networx/services" className="inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Services
          </Link>
        </Button>
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {error || 'Service not found.'}
        </Card>
      </div>
    );
  }

  const isOwner = !!user && user.uid === listing.ownerUserId;
  const hasContact = !!listing.contact;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/pro-networx/services" className="inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Services
        </Link>
      </Button>

      <Card className="p-5 sm:p-6 space-y-4">
        <Link
          href={`/pro-networx/u/${listing.ownerUserId}`}
          className="flex items-center gap-3"
        >
          {listing.ownerAvatarUrl ? (
            <Image
              src={listing.ownerAvatarUrl}
              alt={listing.ownerDisplayName ?? 'Avatar'}
              width={48}
              height={48}
              className="rounded-full object-cover"
              unoptimized={shouldUnoptimize(listing.ownerAvatarUrl)}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              🎨
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground">
              {listing.ownerDisplayName || 'Creator'}
            </p>
            {listing.ownerHeadline && (
              <p className="text-sm text-muted-foreground">{listing.ownerHeadline}</p>
            )}
          </div>
        </Link>

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {listing.serviceType.replace(/_/g, ' ')}
          </p>
          <h1 className="text-2xl font-semibold text-foreground mt-1">{listing.title}</h1>
          {listing.description && (
            <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">
              {listing.description}
            </p>
          )}
        </div>

        <div className="border-t border-border pt-4 flex items-center justify-between">
          <span className="text-xl font-semibold text-foreground">
            {formatPrice(listing.priceCents, listing.currency, listing.rateType)}
          </span>
          {isOwner && (
            <Button asChild variant="outline" size="sm">
              <Link href="/pro-networx/me/services">Manage</Link>
            </Button>
          )}
        </div>
      </Card>

      {hasContact ? (
        <Card className="p-5 sm:p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Contact</h2>
          <div className="space-y-2 text-sm">
            {listing.contact?.email && (
              <a
                href={`mailto:${listing.contact.email}`}
                className="flex items-center gap-2 text-foreground hover:underline"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
                {listing.contact.email}
              </a>
            )}
            {listing.contact?.phone && (
              <a
                href={`tel:${listing.contact.phone}`}
                className="flex items-center gap-2 text-foreground hover:underline"
              >
                <Phone className="h-4 w-4 text-muted-foreground" />
                {listing.contact.phone}
              </a>
            )}
            {listing.contact?.link && (
              <a
                href={listing.contact.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-foreground hover:underline break-all"
              >
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                {listing.contact.link}
              </a>
            )}
            {!listing.contact?.email && !listing.contact?.phone && !listing.contact?.link && (
              <p className="text-muted-foreground">
                This creator has not added contact details. Send them a message instead.
              </p>
            )}
          </div>
          {!isOwner && (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/messages?to=${listing.ownerUserId}`}
                className="inline-flex items-center gap-1"
              >
                <MessageSquare className="h-4 w-4" /> Send a message
              </Link>
            </Button>
          )}
        </Card>
      ) : !isOwner ? (
        <ContactInfoLockedCard
          caption="Subscribe to view this creator's email, phone, and direct booking links."
        />
      ) : null}
    </div>
  );
}
