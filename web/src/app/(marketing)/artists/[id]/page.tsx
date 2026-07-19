import { ArtistPageView } from '@/components/artist/ArtistPageView';

export default async function PublicArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArtistPageView artistId={id} mode="public" />;
}

