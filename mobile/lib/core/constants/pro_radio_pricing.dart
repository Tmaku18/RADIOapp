/// Pro-Radio subscription pricing.
/// Mirrors web/src/data/pro-radio-pricing.ts and
/// backend/src/pro-radio-subscription/pro-radio-subscription.constants.ts.

const int proRadioRegularCents = 999;
const int proRadioIntroCents = 499;

String formatProRadioPriceUsd(int cents) =>
    '\$${(cents / 100).toStringAsFixed(2)}';

final String proRadioRegularDisplay =
    formatProRadioPriceUsd(proRadioRegularCents);
final String proRadioIntroDisplay = formatProRadioPriceUsd(proRadioIntroCents);
