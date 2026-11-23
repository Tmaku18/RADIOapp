import type { Metadata } from 'next';
import { ButterflyPattern } from '@/components/marketing/ButterflyPattern';
import { OpenInAppBanner } from '@/components/marketing/OpenInAppBanner';
import { ANDROID_APP_URL, IOS_APP_URL, iosInstallLabel } from '@/lib/app-install';
import { appCustomSchemeUrl } from '@/lib/app-links';

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
  const appLink = appCustomSchemeUrl('song', id);
  return (
    <section className="relative overflow-hidden border-b border-border py-24">
      <ButterflyPattern
        className="absolute inset-0"
        colorClassName="text-primary"
        tile={140}
        opacity={0.1}
      />
      <div className="relative z-10 mx-auto max-w-xl px-4 text-center">
        <div className="mb-8 text-left">
          <OpenInAppBanner kind="song" id={id} label="Open this song in the app" />
        </div>
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
          <a href={IOS_APP_URL} className="text-sm underline">
            {iosInstallLabel()}
          </a>
          <a href={ANDROID_APP_URL} className="text-sm underline">
            Google Play
          </a>
          <a href="/" className="text-sm underline">
            Listen on the web
          </a>
        </div>
      </div>
    </section>
  );
}
