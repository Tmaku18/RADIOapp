/**
 * Pro Bundle = Pro-Radio + Pro-Networx in one subscription.
 * $12.99/mo vs buying both singly ($4.99 Radio + $9.99 Networx = $14.98).
 * Keep in sync with web + mobile pricing constants.
 */
export const PRO_BUNDLE_REGULAR_CENTS = 1299;
export const PRO_RADIO_SOLO_REGULAR_CENTS = 499;
export const PRO_NETWORX_SOLO_REGULAR_CENTS = 999;
export const PRO_BOTH_SOLO_TOTAL_CENTS =
  PRO_RADIO_SOLO_REGULAR_CENTS + PRO_NETWORX_SOLO_REGULAR_CENTS;

export const PRO_BUNDLE_PAYWALL_PAYLOAD = {
  code: 'PRO_BUNDLE_AVAILABLE' as const,
  regularCents: PRO_BUNDLE_REGULAR_CENTS,
  radioSoloRegularCents: PRO_RADIO_SOLO_REGULAR_CENTS,
  networxSoloRegularCents: PRO_NETWORX_SOLO_REGULAR_CENTS,
  bothSoloTotalCents: PRO_BOTH_SOLO_TOTAL_CENTS,
  savingsCents: PRO_BOTH_SOLO_TOTAL_CENTS - PRO_BUNDLE_REGULAR_CENTS,
};
