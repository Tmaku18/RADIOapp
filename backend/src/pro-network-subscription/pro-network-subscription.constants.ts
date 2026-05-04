/**
 * Single source of truth for Pro Networks subscription pricing on the backend.
 * Mirrors web/src/data/pro-networx-pricing.ts and
 * mobile/lib/core/constants/pro_networx_pricing.dart so display + paywall
 * payloads stay in sync. Stripe handles the actual billing via the configured
 * price ID + a duration: once coupon for the intro discount.
 */
export const PRO_NETWORX_REGULAR_CENTS = 999;
export const PRO_NETWORX_INTRO_CENTS = 499;

/**
 * Structured 403 paywall payload returned by anything gated on the
 * Pro Networks subscription (DM gate, contact info on Services listings, etc.).
 */
export const PRO_NETWORK_PAYWALL_PAYLOAD = {
  code: 'PRO_NETWORK_SUBSCRIPTION_REQUIRED' as const,
  requiresSubscription: true,
  intro: {
    regularCents: PRO_NETWORX_REGULAR_CENTS,
    introCents: PRO_NETWORX_INTRO_CENTS,
  },
};
