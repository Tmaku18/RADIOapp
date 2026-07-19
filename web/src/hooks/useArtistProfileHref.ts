'use client';

import { useAuth } from '@/contexts/AuthContext';
import { resolveArtistProfileHref } from '@/lib/artist-links';

export function useArtistProfileHref(artistId: string): string {
  const { profile } = useAuth();
  return resolveArtistProfileHref(artistId, !!profile);
}
