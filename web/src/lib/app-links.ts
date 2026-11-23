import { ANDROID_APP_URL, IOS_APP_URL } from '@/lib/app-install';

export const ANDROID_PACKAGE_NAME = 'com.tmaktechnologies.networxradio';
export const APP_CUSTOM_SCHEME = 'networxradio';
export const APP_HTTPS_HOST = 'www.networxradio.com';

/**
 * Optional hard-coded SHA-256 fingerprints. Prefer Vercel env
 * `ANDROID_APP_LINK_SHA256` (Play App Signing cert from Play Console →
 * App integrity). Comma-separate multiple values for upload + signing keys.
 */
export const ANDROID_APP_LINK_SHA256_DEFAULTS: string[] = [];

export type AppDeepLinkKind = 'artist' | 'song' | 'radio';

export function appCustomSchemeUrl(kind: AppDeepLinkKind, id: string): string {
  const safe = encodeURIComponent(id.trim());
  return `${APP_CUSTOM_SCHEME}://${kind}/${safe}`;
}

export function appHttpsPath(kind: AppDeepLinkKind, id: string): string {
  const segment = kind === 'artist' ? 'artists' : kind;
  return `/${segment}/${encodeURIComponent(id.trim())}`;
}

/**
 * Android Intent URL that prefers the installed app, then falls back to the
 * https page (or Play Store if the package is missing).
 */
export function androidIntentUrl(kind: AppDeepLinkKind, id: string): string {
  const path = appHttpsPath(kind, id).replace(/^\//, '');
  const fallback = `https://${APP_HTTPS_HOST}/${path}`;
  return (
    `intent://${APP_HTTPS_HOST}/${path}` +
    `#Intent;scheme=https;package=${ANDROID_PACKAGE_NAME};` +
    `S.browser_fallback_url=${encodeURIComponent(fallback)};end`
  );
}

export function storeUrlForUserAgent(ua: string): string {
  if (/Android/i.test(ua)) return ANDROID_APP_URL;
  return IOS_APP_URL;
}

export function resolveAndroidAppLinkFingerprints(): string[] {
  const fromEnv = (process.env.ANDROID_APP_LINK_SHA256 ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
  const defaults = ANDROID_APP_LINK_SHA256_DEFAULTS.map((value) =>
    value.trim().toUpperCase(),
  );
  return [...new Set([...fromEnv, ...defaults])];
}
