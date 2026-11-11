/**
 * Where a listener without the app should download it.
 * Set NEXT_PUBLIC_IOS_APP_URL to the App Store product URL when the listing
 * is live. Until then the public TestFlight link is the iOS destination.
 */
export const IOS_APP_URL =
  process.env.NEXT_PUBLIC_IOS_APP_URL?.trim() ||
  'https://testflight.apple.com/join/Pxbsqkww';

export const ANDROID_APP_URL =
  process.env.NEXT_PUBLIC_ANDROID_APP_URL?.trim() ||
  'https://play.google.com/store/apps/details?id=com.tmaktechnologies.networxradio';

export function isTestFlightInstall(url = IOS_APP_URL): boolean {
  return url.includes('testflight.apple.com');
}

export function iosInstallLabel(url = IOS_APP_URL): string {
  return isTestFlightInstall(url) ? 'Get it on TestFlight' : 'Get it on the App Store';
}
