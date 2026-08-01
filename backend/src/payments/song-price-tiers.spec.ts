import {
  DEFAULT_BEAT_PRICE_CENTS,
  MAX_SONG_PRICE_CENTS,
  MIN_SONG_PRICE_CENTS,
  SONG_PRICE_TIERS_CENTS,
  SONG_PURCHASE_PRODUCT_IDS,
  isSongPriceTier,
  snapToSongPriceTier,
  songPurchaseProductIdForTier,
} from './song-price-tiers';
import { DEFAULT_IAP_PRODUCT_CATALOG } from './iap-product-catalog';

describe('snapToSongPriceTier', () => {
  it('leaves prices that already sit on a tier alone', () => {
    for (const tier of SONG_PRICE_TIERS_CENTS) {
      expect(snapToSongPriceTier(tier)).toBe(tier);
    }
  });

  it('clamps below the floor and above the ceiling', () => {
    expect(snapToSongPriceTier(0)).toBe(MIN_SONG_PRICE_CENTS);
    expect(snapToSongPriceTier(50)).toBe(MIN_SONG_PRICE_CENTS);
    expect(snapToSongPriceTier(999999)).toBe(MAX_SONG_PRICE_CENTS);
  });

  it('rounds to the nearest tier', () => {
    expect(snapToSongPriceTier(120)).toBe(99);
    expect(snapToSongPriceTier(750)).toBe(999);
    expect(snapToSongPriceTier(600)).toBe(499);
  });

  it('resolves an exact midpoint downward so buyers never pay more', () => {
    expect(snapToSongPriceTier(149)).toBe(99);
    expect(snapToSongPriceTier(1499)).toBe(999);
  });

  it('falls back for values that are not numbers', () => {
    expect(snapToSongPriceTier(null)).toBe(99);
    expect(snapToSongPriceTier(undefined)).toBe(99);
    expect(snapToSongPriceTier('abc')).toBe(99);
    expect(snapToSongPriceTier(NaN, DEFAULT_BEAT_PRICE_CENTS)).toBe(999);
  });

  it('always returns a value the tier check accepts', () => {
    for (const raw of [0, 1, 137, 750, 1500, 3500, 90000]) {
      expect(isSongPriceTier(snapToSongPriceTier(raw))).toBe(true);
    }
  });
});

describe('song purchase SKUs', () => {
  it('maps each tier to its documented SKU', () => {
    expect(songPurchaseProductIdForTier(99)).toBe('nwx_song_099');
    expect(songPurchaseProductIdForTier(499)).toBe('nwx_song_499');
    expect(songPurchaseProductIdForTier(4999)).toBe('nwx_song_4999');
  });

  it('produces one unique SKU per tier', () => {
    expect(new Set(SONG_PURCHASE_PRODUCT_IDS).size).toBe(
      SONG_PRICE_TIERS_CENTS.length,
    );
  });

  it('registers every tier in the IAP catalog at the matching amount', () => {
    for (const cents of SONG_PRICE_TIERS_CENTS) {
      const entry = DEFAULT_IAP_PRODUCT_CATALOG[
        songPurchaseProductIdForTier(cents)
      ];
      expect(entry).toBeDefined();
      expect(entry.type).toBe('song_purchase');
      expect(entry.amountCents).toBe(cents);
    }
  });
});
