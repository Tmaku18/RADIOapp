'use client';

import { useEffect, useState } from 'react';
import { venueAdsApi } from '@/lib/api';

type Ad = { id: string; imageUrl: string; linkUrl: string | null; stationId: string };

export function VenueAdSlot({ stationId = 'global', className = '' }: { stationId?: string; className?: string }) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    venueAdsApi.getCurrent(stationId).then((res) => {
      if (!cancelled && res.data) setAd(res.data as Ad);
    }).catch(() => { if (!cancelled) setAd(null); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [stationId]);

  if (loading || !ad) return null;

  const content = (
    <div className="rounded-lg overflow-hidden border border-border bg-muted/50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ad.imageUrl} alt="Venue partner" className="w-full h-full object-contain max-h-24" />
    </div>
  );

  if (ad.linkUrl) {
    return (
      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className={`block ${className}`}>
        {content}
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}
