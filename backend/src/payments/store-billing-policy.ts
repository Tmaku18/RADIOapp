import { BadRequestException } from '@nestjs/common';

/**
 * Digital goods sold inside the iOS/Android app must go through App Store or
 * Google Play billing. Apple only permits external purchase links on the US
 * storefront, and Google Play requires enrolling in its external content links
 * program, so shipping worldwide means mobile never touches Stripe for these.
 *
 * Standalone (rather than a service method) so controllers can call it without
 * injecting PaymentsService and creating DI cycles.
 */
export function assertStripeAllowedForDigitalGoods(
  platform?: string | null,
): void {
  const p = (platform ?? '').trim().toLowerCase();
  if (p === 'ios' || p === 'android') {
    throw new BadRequestException(
      'Digital purchases on mobile must use the App Store or Google Play. Stripe is web-only for these products.',
    );
  }
}
