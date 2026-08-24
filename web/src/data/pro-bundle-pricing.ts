/**
 * Pro Bundle = Pro-Radio + Pro-Networx.
 * Keep in sync with:
 * - backend/src/pro-bundle-subscription/pro-bundle-subscription.constants.ts
 * - mobile/lib/core/constants/pro_bundle_pricing.dart
 */

export const PRO_BUNDLE_REGULAR_CENTS = 1299;
export const PRO_RADIO_SOLO_REGULAR_CENTS = 499;
export const PRO_NETWORX_SOLO_REGULAR_CENTS = 999;
export const PRO_BOTH_SOLO_TOTAL_CENTS =
  PRO_RADIO_SOLO_REGULAR_CENTS + PRO_NETWORX_SOLO_REGULAR_CENTS;
export const PRO_BUNDLE_SAVINGS_CENTS =
  PRO_BOTH_SOLO_TOTAL_CENTS - PRO_BUNDLE_REGULAR_CENTS;

export function formatProBundlePriceUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const PRO_BUNDLE_REGULAR_DISPLAY = formatProBundlePriceUsd(
  PRO_BUNDLE_REGULAR_CENTS,
);
export const PRO_BOTH_SOLO_TOTAL_DISPLAY = formatProBundlePriceUsd(
  PRO_BOTH_SOLO_TOTAL_CENTS,
);
