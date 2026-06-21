import { ProNetworxRootPage } from './ProNetworxRootPage';
import { fetchProNetworxMarketingStats } from '@/lib/pro-networx-marketing-stats';

export const revalidate = 60;

export default async function ProNetworxLandingPage() {
  const initialMarketingStats = await fetchProNetworxMarketingStats();
  return <ProNetworxRootPage initialMarketingStats={initialMarketingStats} />;
}
