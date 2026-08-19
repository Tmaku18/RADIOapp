'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { studiosApi, type Studio } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContactInfoLockedCard } from '@/components/pro-networx/PaywallCard';

function formatRate(cents: number, unit: string): string {
  const dollars = (cents / 100).toFixed(2);
  const suffix =
    unit === 'day'
      ? '/day'
      : unit === 'half_day'
        ? '/half day'
        : unit === 'session'
          ? '/session'
          : '/hr';
  return `$${dollars}${suffix}`;
}

export default function StudioProfilePage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [studio, setStudio] = useState<Studio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await studiosApi.getOne(id);
        if (!cancelled) setStudio(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }
  if (error || !studio) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-muted-foreground">
        {error ?? 'Studio not found'}
      </div>
    );
  }

  const location = studio.locationPrecision === 'exact'
    ? [studio.addressLine1, studio.city, studio.state, studio.zipCode]
        .filter(Boolean)
        .join(', ')
    : [studio.city, studio.zipCode].filter(Boolean).join(' · ') +
      (studio.city || studio.zipCode ? ' (approximate area)' : '');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {studio.heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={studio.heroImageUrl}
          alt=""
          className="w-full h-56 object-cover rounded-2xl"
        />
      )}
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300">Studio</div>
        <h1 className="text-3xl font-semibold text-foreground mt-1">{studio.name}</h1>
        {studio.tagline && (
          <p className="text-muted-foreground mt-2">{studio.tagline}</p>
        )}
        {studio.startingAtCents != null && (
          <p className="text-cyan-300 font-semibold mt-3">
            Starting at {formatRate(studio.startingAtCents, studio.startingAtUnit ?? 'hour')}
          </p>
        )}
        {location && <p className="text-sm text-muted-foreground mt-2">{location}</p>}
      </div>

      {(studio.photos?.length ?? 0) > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {(studio.photos ?? []).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className="h-28 w-40 object-cover rounded-xl shrink-0"
            />
          ))}
        </div>
      )}

      {studio.contactLocked ? (
        <ContactInfoLockedCard caption="A Pro-Networx subscription is required to contact this studio." />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/messages?with=${studio.ownerUserId}`}>Contact us</Link>
          </Button>
          {studio.bookingLink && (
            <Button variant="outline" asChild>
              <a href={studio.bookingLink} target="_blank" rel="noreferrer">
                Book
              </a>
            </Button>
          )}
          {studio.contactEmail && (
            <Button variant="outline" asChild>
              <a href={`mailto:${studio.contactEmail}`}>Email</a>
            </Button>
          )}
        </div>
      )}

      {studio.about && (
        <Card className="p-5">
          <h2 className="font-semibold mb-2">About us</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{studio.about}</p>
        </Card>
      )}

      {(studio.hours?.length ?? 0) > 0 && (
        <Card className="p-5 space-y-1">
          <h2 className="font-semibold mb-2">Hours</h2>
          {(studio.hours ?? []).map((h) => (
            <div key={h.day} className="flex justify-between text-sm">
              <span>{h.day}</span>
              <span className="text-muted-foreground">
                {h.closed || !h.open ? 'Closed' : `${h.open}–${h.close}`}
              </span>
            </div>
          ))}
        </Card>
      )}

      {(studio.members?.length ?? 0) > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Book a producer or artist</h2>
          {(studio.members ?? []).map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{m.displayName || 'Creator'}</div>
                <div className="text-xs text-muted-foreground">
                  {[m.title, m.headline].filter(Boolean).join(' · ')}
                </div>
              </div>
              {studio.contactLocked ? (
                <span className="text-xs text-muted-foreground">Pro-Networx required</span>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/messages?with=${m.userId}`}>Contact</Link>
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}

      {(studio.amenities?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {(studio.amenities ?? []).map((a) => (
            <Badge key={a} variant="secondary">
              {a}
            </Badge>
          ))}
        </div>
      )}

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Rates</h2>
        {(studio.rates?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Contact the owner for pricing.</p>
        ) : (
          (studio.rates ?? []).map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{r.label}</div>
                {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
              </div>
              <div className="font-semibold text-cyan-300">
                {formatRate(r.priceCents, r.unit)}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
