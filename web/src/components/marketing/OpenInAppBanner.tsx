'use client';

import { useEffect, useMemo } from 'react';
import {
  ANDROID_APP_URL,
  IOS_APP_URL,
  iosInstallLabel,
} from '@/lib/app-install';
import {
  androidIntentUrl,
  appCustomSchemeUrl,
  type AppDeepLinkKind,
} from '@/lib/app-links';

type OpenInAppBannerProps = {
  kind: AppDeepLinkKind;
  id: string;
  /** Attempt an automatic handoff into the installed app on phones. */
  autoOpen?: boolean;
  label?: string;
};

/**
 * Prefer the installed native app via custom scheme / Android intent.
 * Store links remain as a fallback when the app is not installed.
 */
export function OpenInAppBanner({
  kind,
  id,
  autoOpen = true,
  label = 'Open in the NetworX app',
}: OpenInAppBannerProps) {
  const customUrl = useMemo(() => appCustomSchemeUrl(kind, id), [kind, id]);
  const intentUrl = useMemo(() => androidIntentUrl(kind, id), [kind, id]);

  useEffect(() => {
    if (!autoOpen || !id.trim()) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('web') === '1') return;

    const ua = navigator.userAgent;
    const isiOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    if (!isiOS && !isAndroid) return;

    const gateKey = `nwx_open_app:${kind}:${id}`;
    try {
      if (sessionStorage.getItem(gateKey) === '1') return;
      sessionStorage.setItem(gateKey, '1');
    } catch {
      // sessionStorage may be blocked; still attempt once this load.
    }

    const target = isAndroid ? intentUrl : customUrl;
    const timer = window.setTimeout(() => {
      try {
        window.location.href = target;
      } catch {
        // Ignore — user can tap the button.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [autoOpen, customUrl, id, intentUrl, kind]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Have the app? Open this profile there. Otherwise grab it below.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <a href={customUrl} className="font-medium text-primary underline">
          {label}
        </a>
        <a href={IOS_APP_URL} className="font-medium underline">
          {iosInstallLabel()}
        </a>
        <a href={ANDROID_APP_URL} className="font-medium underline">
          Google Play
        </a>
      </div>
    </div>
  );
}
