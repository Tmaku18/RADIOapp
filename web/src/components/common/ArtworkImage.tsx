'use client';

import { useMemo, useState } from 'react';
import { resolveTrackArtworkUrl } from '@/lib/media-artwork';

type ArtworkImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackSrc?: string;
};

export function ArtworkImage({
  src,
  alt = '',
  className,
  fallbackSrc,
}: ArtworkImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const normalizedSrc = useMemo(() => {
    const trimmed = typeof src === 'string' ? src.trim() : '';
    if (!trimmed) return null;
    const resolved = resolveTrackArtworkUrl(trimmed);
    // If the server sent a deprecated mark, treat it as absent so we show the wordmark.
    return resolved === trimmed ? trimmed : null;
  }, [src]);

  const selectedFallbackSrc = useMemo(() => {
    if (fallbackSrc?.trim()) return fallbackSrc.trim();
    return resolveTrackArtworkUrl(null);
  }, [fallbackSrc]);

  const isBrokenCurrentSrc = !!normalizedSrc && failedSrc === normalizedSrc;
  const finalSrc = isBrokenCurrentSrc || !normalizedSrc ? selectedFallbackSrc : normalizedSrc;

  return (
     
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (normalizedSrc) setFailedSrc(normalizedSrc);
      }}
    />
  );
}
