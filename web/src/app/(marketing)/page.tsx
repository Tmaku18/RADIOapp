import { DimensionHomeSections } from '@/components/dimension/DimensionHomeSections';
import { DimensionFinalCta, DimensionGlossarySection } from '@/components/dimension/DimensionGlossary';
import { type TrendingData } from '@/components/marketing/TrendingShowcase';
import { getBackendBaseUrls } from '@/lib/backend-url';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export const revalidate = 60;

async function getHomepageData() {
  const fetchJsonWithTimeout = async <T,>(url: string, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        next: { revalidate: 60 },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  };

  const emptyTrending: TrendingData = {
    songs: [],
    artists: [],
    temperature: { average: 50, top: 50 },
  };

  const empty = {
    stats: {
      totalUsers: 0,
      totalSongs: 0,
      totalLikes: 0,
      liveListeners: 0,
      earsReached: 0,
    },
    trending: emptyTrending,
  };

  const fetchTrending = async (baseUrl: string): Promise<TrendingData | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await fetchJsonWithTimeout<TrendingData>(
        `${baseUrl}/api/songs/public/trending?limit=12`,
        12000,
      );
      if (result && Array.isArray(result.songs) && result.songs.length > 0) {
        return result;
      }
    }
    return null;
  };

  try {
    for (const baseUrl of getBackendBaseUrls()) {
      const [platform, live, trending] = await Promise.all([
        fetchJsonWithTimeout<{
          totalUsers?: number;
          totalSongs?: number;
          totalLikes?: number;
        }>(`${baseUrl}/api/analytics/platform`),
        fetchJsonWithTimeout<{
          liveListeners?: number;
          earsReached?: number;
        }>(`${baseUrl}/api/analytics/platform/live`),
        fetchTrending(baseUrl),
      ]);
      if (!platform && !live && !trending) continue;

      return {
        stats: {
          totalUsers: platform?.totalUsers ?? 0,
          totalSongs: platform?.totalSongs ?? 0,
          totalLikes: platform?.totalLikes ?? 0,
          liveListeners: live?.liveListeners ?? 0,
          earsReached: live?.earsReached ?? 0,
        },
        trending: trending ?? emptyTrending,
      };
    }
  } catch (error) {
    console.error('Failed to fetch platform stats:', error);
  }

  return empty;
}

export default async function HomePage() {
  const data = await getHomepageData();

  return (
    <div className="relative" data-testid="home-page">
      <DimensionHomeSections stats={data.stats} trending={data.trending} />
      <DimensionGlossarySection />
      <DimensionFinalCta />
    </div>
  );
}
