// Pro Bundle = Pro-Radio + Pro-Networx in one plan.
// Mirrors web/src/data/pro-bundle-pricing.ts and
// backend/src/pro-bundle-subscription/pro-bundle-subscription.constants.ts.

const int proBundleRegularCents = 1299;
const int proRadioSoloRegularCents = 499;
const int proNetworxSoloRegularCents = 999;
const int proBothSoloTotalCents =
    proRadioSoloRegularCents + proNetworxSoloRegularCents;
const int proBundleSavingsCents =
    proBothSoloTotalCents - proBundleRegularCents;

String formatProBundlePriceUsd(int cents) =>
    '\$${(cents / 100).toStringAsFixed(2)}';

final String proBundleRegularDisplay =
    formatProBundlePriceUsd(proBundleRegularCents);
final String proBothSoloTotalDisplay =
    formatProBundlePriceUsd(proBothSoloTotalCents);
final String proBundleSavingsDisplay =
    formatProBundlePriceUsd(proBundleSavingsCents);
