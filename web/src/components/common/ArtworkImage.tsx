'use client';

import { useEffect, useMemo, useState } from 'react';

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

export function ArtworkImage({
  src,
  alt = '',
  className,
  fallbackSrc,
}: ArtworkImageProps) {
  const [broken, setBroken] = useState(false);
  const normalizedSrc = useMemo(() => {
    const trimmed = typeof src === 'string' ? src.trim() : '';
    return trimmed || null;
  }, [src]);

  useEffect(() => {
    // Re-evaluate when artwork URL changes (prevents stale fallback state).
    setBroken(false);
  }, [normalizedSrc]);

  const selectedFallbackSrc = useMemo(() => {
    if (fallbackSrc?.trim()) return fallbackSrc.trim();
    const idx = Math.floor(Math.random() * DEFAULT_ALBUM_ART_FALLBACKS.length);
    return DEFAULT_ALBUM_ART_FALLBACKS[idx];
  }, [fallbackSrc, normalizedSrc]);

  const finalSrc = broken || !normalizedSrc ? selectedFallbackSrc : normalizedSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        // Only fallback when an uploaded artwork URL fails to load.
        if (normalizedSrc) setBroken(true);
      }}
    />
  );
}
