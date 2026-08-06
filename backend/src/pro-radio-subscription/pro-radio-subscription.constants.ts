/**
 * Pro-Radio subscription pricing. Mirrors
 * web/src/data/pro-radio-pricing.ts and
 * mobile/lib/core/constants/pro_radio_pricing.dart.
 */
export const PRO_RADIO_REGULAR_CENTS = 999;
export const PRO_RADIO_INTRO_CENTS = 499;

export const PRO_RADIO_PAYWALL_PAYLOAD = {
  code: 'PRO_RADIO_SUBSCRIPTION_REQUIRED' as const,
  requiresSubscription: true,
  intro: {
    regularCents: PRO_RADIO_REGULAR_CENTS,
    introCents: PRO_RADIO_INTRO_CENTS,
  },
};
