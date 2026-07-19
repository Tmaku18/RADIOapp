import { ArtistsGallery } from '@/components/dimension/ArtistsGallery';
import type { TrendingData } from '@/components/marketing/TrendingShowcase';
import { getBackendBaseUrls } from '@/lib/backend-url';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Artists - Networx',
  description: 'Discover trending gems and diamonds on Networx — hidden talent refined under pressure.',
  alternates: { canonical: '/artists' },
};

export const revalidate = 60;

async function getTrendingArtists() {
  const fetchJson = async <T,>(url: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, { next: { revalidate: 60 }, signal: controller.signal });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  };

  for (const baseUrl of getBackendBaseUrls()) {
    const data = await fetchJson<TrendingData>(
      `${baseUrl}/api/songs/public/trending?limit=24`,
    );
    if (data?.artists?.length) return data.artists;
  }
  return [];
}

export default async function ArtistsPage() {
  const artists = await getTrendingArtists();
  return <ArtistsGallery artists={artists} />;
}
