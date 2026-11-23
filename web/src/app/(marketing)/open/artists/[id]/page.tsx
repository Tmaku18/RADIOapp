import type { Metadata } from 'next';
import { ArtistPageView } from '@/components/artist/ArtistPageView';

export const metadata: Metadata = {
  title: 'Artist on NetworX Radio',
  description: 'Open this artist in the NetworX Radio app.',
};

/**
 * Share landing outside Universal / App Link path claims so SMS/iMessage open
 * the browser reliably, then OpenInAppBanner hands off to the installed app.
 */
export default async function OpenArtistSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArtistPageView artistId={id} mode="public" />;
}
