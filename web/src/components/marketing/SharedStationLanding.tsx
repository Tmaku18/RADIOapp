'use client';

import { useEffect } from 'react';
import { ButterflyPattern } from '@/components/marketing/ButterflyPattern';
import { ANDROID_APP_URL, IOS_APP_URL, iosInstallLabel } from '@/lib/app-install';
import { stationDisplayName } from '@/lib/radio-share';

export function SharedStationLanding({ stationId }: { stationId: string }) {
  const name = stationDisplayName(stationId);
  const appLink = `networxradio://radio/${encodeURIComponent(stationId)}`;
  const webLink = `/listen?station=${encodeURIComponent(stationId)}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('web') === '1') return;
    const ua = navigator.userAgent;
    const isiOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    if (!isiOS && !isAndroid) return;
    const destination = isiOS ? IOS_APP_URL : ANDROID_APP_URL;
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      window.location.assign(destination);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="relative overflow-hidden border-b border-border py-24">
      <ButterflyPattern
        className="absolute inset-0"
        colorClassName="text-primary"
        tile={140}
        opacity={0.1}
      />
      <div className="relative z-10 mx-auto max-w-xl px-4 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">NetworX Radio</p>
        <h1 className="mt-3 text-3xl font-semibold">{name}</h1>
        <p className="mt-4 text-muted-foreground">
          This station opens in the app if you already have it. Otherwise it takes you to download NetworX Radio.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href={appLink}
            className="inline-flex rounded-full bg-primary px-6 py-3 text-primary-foreground"
          >
            Open in the app
          </a>
          <a
            href={IOS_APP_URL}
            className="inline-flex rounded-full border border-primary px-6 py-3"
          >
            {iosInstallLabel()}
          </a>
          <a href={ANDROID_APP_URL} className="text-sm underline">
            Get it on Google Play
          </a>
          <a href={webLink} className="text-sm underline">
            Listen on the web instead
          </a>
        </div>
      </div>
    </section>
  );
}
