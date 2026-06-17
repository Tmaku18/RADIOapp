'use client';

import { useMemo, useState } from 'react';
import { NETWORX_LOGO } from '@/lib/brand-assets';

type ArtworkImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackSrc?: string;
};

// Coverless songs fall back to the official cyan wordmark plus on-brand
// illustrative art. The old blue/wordless logos (Logo_0/1, NX_0, Eye_*, and the
// "Studio Network" mark) were retired in favor of the cyan branding.
const DEFAULT_ALBUM_ART_FALLBACKS = [
  NETWORX_LOGO,
  '/images/og-flyer.png',
  '/images/welcome-to-the-networx.png',
];

function stableFallbackIndex(seed: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % Math.max(size, 1);
}

export function ArtworkImage({
  src,
  alt = '',
  className,
  fallbackSrc,
}: ArtworkImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const normalizedSrc = useMemo(() => {
    const trimmed = typeof src === 'string' ? src.trim() : '';
    return trimmed || null;
  }, [src]);

  const selectedFallbackSrc = useMemo(() => {
    if (fallbackSrc?.trim()) return fallbackSrc.trim();
    const seed = normalizedSrc || alt || 'default-fallback';
    const idx = stableFallbackIndex(seed, DEFAULT_ALBUM_ART_FALLBACKS.length);
    return DEFAULT_ALBUM_ART_FALLBACKS[idx];
  }, [fallbackSrc, normalizedSrc, alt]);

  const isBrokenCurrentSrc = !!normalizedSrc && failedSrc === normalizedSrc;
  const finalSrc = isBrokenCurrentSrc || !normalizedSrc ? selectedFallbackSrc : normalizedSrc;

  return (
     
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        // Only fallback when an uploaded artwork URL fails to load.
        if (normalizedSrc) setFailedSrc(normalizedSrc);
      }}
    />
  );
}
