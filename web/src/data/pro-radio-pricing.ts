/**
 * Pro-Radio subscription pricing.
 * Keep in sync with backend/src/pro-radio-subscription/pro-radio-subscription.constants.ts
 * and mobile/lib/core/constants/pro_radio_pricing.dart.
 */

export const PRO_RADIO_REGULAR_CENTS = 999;
export const PRO_RADIO_INTRO_CENTS = 499;

export function formatProRadioPriceUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const PRO_RADIO_REGULAR_DISPLAY = formatProRadioPriceUsd(
  PRO_RADIO_REGULAR_CENTS,
);
export const PRO_RADIO_INTRO_DISPLAY = formatProRadioPriceUsd(
  PRO_RADIO_INTRO_CENTS,
);
