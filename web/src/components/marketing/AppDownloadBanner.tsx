'use client';

import { ANDROID_APP_URL, IOS_APP_URL, iosInstallLabel } from '@/lib/app-install';

export function AppDownloadBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Hear this artist on live radio in the NetworX app.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <a href={IOS_APP_URL} className="font-medium text-primary underline">
          {iosInstallLabel()}
        </a>
        <a href={ANDROID_APP_URL} className="font-medium underline">
          Google Play
        </a>
      </div>
    </div>
  );
}
