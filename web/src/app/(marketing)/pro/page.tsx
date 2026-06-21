import { ProNetworxLanding } from '@/components/dimension/ProNetworxLanding';
import { fetchProNetworxMarketingStats } from '@/lib/pro-networx-marketing-stats';

export const revalidate = 60;

export default async function ProPage() {
  const initialMarketingStats = await fetchProNetworxMarketingStats();
  return (
    <ProNetworxLanding
      variant="marketing"
      initialMarketingStats={initialMarketingStats}
    />
  );
}
