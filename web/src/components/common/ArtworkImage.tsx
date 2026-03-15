'use client';

import { useMemo, useState } from 'react';

type ArtworkImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackSrc?: string;
};

const DEFAULT_ALBUM_ART_FALLBACKS = [
  '/images/ChatGPT%20Image%20Feb%2017%2C%202026%2C%2002_00_58%20AM.png',
  '/images/Eye_0.png',
  '/images/Eye_1.png',
  '/images/Eye_2.png',
  '/images/Eye_3.png',
  '/images/Logo_0.png',
  '/images/Logo_1.png',
  '/images/NX_0.png',
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
    // eslint-disable-next-line @next/next/no-img-element
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
