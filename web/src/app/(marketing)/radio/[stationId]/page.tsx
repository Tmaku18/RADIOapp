import type { Metadata } from 'next';
import { SharedStationLanding } from '@/components/marketing/SharedStationLanding';
import { stationDisplayName } from '@/lib/radio-share';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stationId: string }>;
}): Promise<Metadata> {
  const { stationId } = await params;
  const name = stationDisplayName(stationId);
  return {
    title: `${name} on NetworX Radio`,
    description: `Listen to ${name}. Opens in the app, or downloads it if you don't have it yet.`,
  };
}

export default async function SharedStationPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  return <SharedStationLanding stationId={stationId} />;
}
