'use client';

import { useEffect, useMemo, useState } from 'react';

type ArtworkImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackSrc?: string;
};

const DEFAULT_ALBUM_ART_FALLBACK = '/icons/icon.svg';

export function ArtworkImage({
  src,
  alt = '',
  className,
  fallbackSrc = DEFAULT_ALBUM_ART_FALLBACK,
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

  const finalSrc = broken || !normalizedSrc ? fallbackSrc : normalizedSrc;

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
