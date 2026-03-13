'use client';

import { useMemo, useState } from 'react';

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

  const finalSrc = useMemo(() => {
    if (broken) return fallbackSrc;
    const trimmed = typeof src === 'string' ? src.trim() : '';
    return trimmed || fallbackSrc;
  }, [src, broken, fallbackSrc]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
