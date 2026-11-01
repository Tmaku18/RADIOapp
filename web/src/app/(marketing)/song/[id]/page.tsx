import type { Metadata } from 'next';
import { ButterflyPattern } from '@/components/marketing/ButterflyPattern';

export const metadata: Metadata = {
  title: 'Listen on NetworX Radio',
  description: 'Open this song in the NetworX Radio app.',
};

export default async function SharedSongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appLink = `networxradio://song/${encodeURIComponent(id)}`;
  return (
    <section className="relative overflow-hidden border-b border-border py-24">
      <ButterflyPattern
        className="absolute inset-0"
        colorClassName="text-primary"
        tile={140}
        opacity={0.1}
      />
      <div className="relative z-10 mx-auto max-w-xl px-4 text-center">
        <h1 className="text-3xl font-semibold">This song is on NetworX</h1>
        <p className="mt-4 text-muted-foreground">
          Open it in the app to hear the station, or keep listening on the web.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href={appLink}
            className="inline-flex rounded-full bg-primary px-6 py-3 text-primary-foreground"
          >
            Open in the app
          </a>
          <a href="/" className="text-sm underline">
            Listen on the web
          </a>
        </div>
      </div>
    </section>
  );
}
