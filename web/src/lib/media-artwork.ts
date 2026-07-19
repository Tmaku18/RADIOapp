import { NETWORX_LOGO } from '@/lib/brand-assets';

/** Legacy compact mark and retired assets — not the full cyan wordmark. */
export function isDeprecatedArtwork(url: string | null | undefined): boolean {
  if (!url?.trim()) return true;
  const lower = url.trim().toLowerCase();
  return (
    lower.includes('logo-icon') ||
    lower.includes('logo_icon') ||
    lower.includes('logo_0') ||
    lower.includes('logo_1') ||
    lower.includes('/nx_0') ||
    lower.includes('/icons/pwa-') ||
    lower.includes('og-flyer')
  );
}

/** Relative or absolute artwork URL for UI and Media Session. */
export function resolveTrackArtworkUrl(
  artworkUrl: string | null | undefined,
): string {
  if (artworkUrl?.trim() && !isDeprecatedArtwork(artworkUrl)) {
    return artworkUrl.trim();
  }
  return NETWORX_LOGO;
}

export function absoluteArtworkUrl(
  relativeOrAbsolute: string,
  origin?: string,
): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) {
    return relativeOrAbsolute;
  }
  const base =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) return relativeOrAbsolute;
  return `${base}${relativeOrAbsolute.startsWith('/') ? '' : '/'}${relativeOrAbsolute}`;
}

export function mediaSessionArtworkEntries(
  artworkUrl: string | null | undefined,
  origin?: string,
): MediaImage[] {
  const resolved = absoluteArtworkUrl(resolveTrackArtworkUrl(artworkUrl), origin);
  return [
    { src: resolved, sizes: '192x192', type: 'image/png' },
    { src: resolved, sizes: '512x512', type: 'image/png' },
    { src: resolved, sizes: '1024x1024', type: 'image/png' },
  ];
}
