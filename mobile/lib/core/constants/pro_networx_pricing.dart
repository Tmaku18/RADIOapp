// Pro Networks subscription pricing.
// Mirrors web/src/data/pro-networx-pricing.ts so display stays in sync.
// The Stripe coupon (duration: once, amount_off: 500) handles the actual
// billing; these constants only drive display.

const int proNetworxRegularCents = 999;
const int proNetworxIntroCents = 499;

String formatProNetworxPriceUsd(int cents) =>
    '\$${(cents / 100).toStringAsFixed(2)}';

final String proNetworxRegularDisplay =
    formatProNetworxPriceUsd(proNetworxRegularCents);
final String proNetworxIntroDisplay =
    formatProNetworxPriceUsd(proNetworxIntroCents);

/// Soft promo shown while messaging is free during beta.
final String proNetworxMessagingBetaPromo =
    'Messaging is free during beta. Pro-Networx is $proNetworxIntroDisplay '
    'first month, then $proNetworxRegularDisplay/mo — or Pro Bundle '
    '(Radio + Networx) for \$12.99/mo.';
