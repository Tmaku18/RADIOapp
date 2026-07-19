/** True on iOS Safari / iPadOS (volume API behaves differently). */
export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  );
}

/**
 * True for Apple Safari (iOS + macOS desktop). Excludes Chrome/Firefox/Edge on
 * iOS/macOS which include "Safari" in the UA but also CriOS/FxiOS/Edg/Chrome.
 */
export function isSafari(): boolean {
  if (typeof window === 'undefined') return false;
  if (isIosSafari()) return true;
  const ua = window.navigator.userAgent;
  const isSafariUa =
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Opera|Android/i.test(ua);
  return isSafariUa;
}

/** Prefer Apple's native HLS when the element can play MPEG-TS/HLS. */
export function canPlayNativeHls(media: HTMLMediaElement): boolean {
  try {
    return media.canPlayType('application/vnd.apple.mpegurl') !== '';
  } catch {
    return false;
  }
}
