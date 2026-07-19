import { proDisciplines, proStats, type ProDiscipline } from '@/data/pro-marketing-data';
import { getBackendBaseUrls } from '@/lib/backend-url';

export type ProMarketingStats = {
  catalysts: number;
  countries: number;
  disciplines: number;
  matchesThisMonth: number;
  disciplinesBreakdown: ProDiscipline[];
};

type MarketingStatsResponse = {
  catalysts?: number;
  countries?: number;
  disciplines?: number;
  matchesThisMonth?: number;
  disciplinesBreakdown?: Array<{
    icon: string;
    label: string;
    color: 'cyan' | 'pink' | 'yellow';
    count: number;
  }>;
};

export function mapProMarketingStatsResponse(
  data: MarketingStatsResponse | null | undefined,
): ProMarketingStats | null {
  if (!data) return null;

  const disciplinesBreakdown =
    data.disciplinesBreakdown?.map((d) => ({
      icon: d.icon,
      label: d.label,
      count: d.count,
      color: d.color,
    })) ?? [];

  return {
    catalysts: data.catalysts ?? proStats.catalysts,
    countries: data.countries ?? proStats.countries,
    disciplines: data.disciplines ?? proStats.disciplines,
    matchesThisMonth: data.matchesThisMonth ?? proStats.matchesThisMonth,
    disciplinesBreakdown:
      disciplinesBreakdown.length > 0 ? disciplinesBreakdown : proDisciplines,
  };
}

export async function fetchProNetworxMarketingStats(): Promise<ProMarketingStats | null> {
  const bases = getBackendBaseUrls();
  if (bases.length === 0) return null;

  for (const baseUrl of bases) {
    try {
      const response = await fetch(
        `${baseUrl}/api/pro-networx/public/marketing-stats`,
        { next: { revalidate: 60 } },
      );
      if (!response.ok) continue;
      const data = (await response.json()) as MarketingStatsResponse;
      return mapProMarketingStatsResponse(data);
    } catch {
      // Try the next configured backend host.
    }
  }

  return null;
}

export function heroStatsFromMarketing(
  stats: ProMarketingStats | null | undefined,
): typeof proStats {
  if (!stats) return proStats;
  return {
    catalysts: stats.catalysts,
    countries: stats.countries,
    disciplines: stats.disciplines,
    matchesThisMonth: stats.matchesThisMonth,
  };
}

export function disciplinesFromMarketing(
  stats: ProMarketingStats | null | undefined,
): ProDiscipline[] {
  if (stats?.disciplinesBreakdown?.length) return stats.disciplinesBreakdown;
  return proDisciplines;
}
