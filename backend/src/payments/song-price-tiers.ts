/**
 * Fixed price ladder for song and beat sales.
 *
 * App Store and Google Play can only sell pre-registered products at fixed
 * prices, so artist-set prices are snapped onto this ladder and every tier has
 * a matching consumable SKU. Keep this in sync with
 * `mobile/lib/core/constants/song_price_tiers.dart` and the products created in
 * both consoles (see `mobile/docs/APP_STORE_IAP.md`).
 */
export const SONG_PRICE_TIERS_CENTS = [
  99, 199, 299, 499, 999, 1999, 2999, 4999,
] as const;

export type SongPriceTierCents = (typeof SONG_PRICE_TIERS_CENTS)[number];

export const MIN_SONG_PRICE_CENTS = SONG_PRICE_TIERS_CENTS[0];
export const MAX_SONG_PRICE_CENTS =
  SONG_PRICE_TIERS_CENTS[SONG_PRICE_TIERS_CENTS.length - 1];

export const DEFAULT_SONG_PRICE_CENTS: SongPriceTierCents = 99;
export const DEFAULT_BEAT_PRICE_CENTS: SongPriceTierCents = 999;

/** Store SKU that sells a song/beat at the given tier. */
export function songPurchaseProductIdForTier(
  cents: SongPriceTierCents,
): string {
  return `nwx_song_${cents.toString().padStart(3, '0')}`;
}

export const SONG_PURCHASE_PRODUCT_IDS: string[] =
  SONG_PRICE_TIERS_CENTS.map(songPurchaseProductIdForTier);

export function isSongPriceTier(cents: unknown): cents is SongPriceTierCents {
  return (
    typeof cents === 'number' &&
    SONG_PRICE_TIERS_CENTS.includes(cents as SongPriceTierCents)
  );
}

/**
 * Snap an arbitrary price onto the nearest tier. Ties resolve downward so a
 * price sitting exactly between two tiers never silently costs buyers more.
 */
export function snapToSongPriceTier(
  cents: unknown,
  fallback: SongPriceTierCents = DEFAULT_SONG_PRICE_CENTS,
): SongPriceTierCents {
  const value = Number(cents);
  if (!Number.isFinite(value)) return fallback;
  if (value <= MIN_SONG_PRICE_CENTS) return MIN_SONG_PRICE_CENTS;
  if (value >= MAX_SONG_PRICE_CENTS) return MAX_SONG_PRICE_CENTS;

  let best: SongPriceTierCents = SONG_PRICE_TIERS_CENTS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const tier of SONG_PRICE_TIERS_CENTS) {
    const distance = Math.abs(tier - value);
    if (distance < bestDistance) {
      best = tier;
      bestDistance = distance;
    }
  }
  return best;
}
