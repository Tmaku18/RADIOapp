/**
 * Pro Networks subscription pricing.
 * Single source of truth on the web side; mobile mirrors these values in
 * mobile/lib/core/constants/pro_networx_pricing.dart.
 *
 * The Stripe coupon (duration: once, amount_off: 500) handles the actual
 * billing; these constants only drive display.
 */

export const PRO_NETWORX_REGULAR_CENTS = 999;
export const PRO_NETWORX_INTRO_CENTS = 499;

export function formatProNetworxPriceUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const PRO_NETWORX_REGULAR_DISPLAY = formatProNetworxPriceUsd(
  PRO_NETWORX_REGULAR_CENTS,
);
export const PRO_NETWORX_INTRO_DISPLAY = formatProNetworxPriceUsd(
  PRO_NETWORX_INTRO_CENTS,
);
