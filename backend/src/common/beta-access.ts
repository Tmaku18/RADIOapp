/**
 * Master beta switch: every subscription feature is unlocked without paying so
 * testers can exercise the whole product.
 *
 * Scope is deliberately limited to *subscription* gates — Pro-Radio,
 * Pro-Networx and Creator Network. One-off purchases are untouched: song sales
 * are artist revenue, and handing out free credits or plays would distort the
 * listener thresholds that decide when a station enters paid rotation.
 *
 * Clients should keep promoting pricing while this is on, the same way
 * `isProNetworxMessagingBetaFree` already does for DMs.
 *
 * Paid by default. Set BETA_ALL_FREE=true only for an explicit free test window.
 */
export function isBetaAllFree(): boolean {
  return (process.env.BETA_ALL_FREE ?? 'false').toLowerCase() === 'true';
}
