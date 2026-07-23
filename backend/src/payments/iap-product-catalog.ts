/**
 * Default IAP product catalog for App Store + Google Play.
 * Env JSON (APPLE_IAP_PRODUCT_CATALOG_JSON / GOOGLE_PLAY_PRODUCT_CATALOG_JSON)
 * merges on top of these defaults.
 */
export type IapCatalogEntry = {
  type: 'credits' | 'song_plays' | 'tip' | 'pro_networx_subscription';
  amountCents: number;
  credits?: number;
  plays?: number;
};

export const DEFAULT_IAP_PRODUCT_CATALOG: Record<string, IapCatalogEntry> = {
  nwx_credits_10: { type: 'credits', amountCents: 999, credits: 10 },
  nwx_credits_25: { type: 'credits', amountCents: 1999, credits: 25 },
  nwx_credits_50: { type: 'credits', amountCents: 3499, credits: 50 },
  nwx_credits_100: { type: 'credits', amountCents: 5999, credits: 100 },
  nwx_song_plays_1: { type: 'song_plays', amountCents: 199, plays: 1 },
  nwx_song_plays_3: { type: 'song_plays', amountCents: 597, plays: 3 },
  nwx_song_plays_5: { type: 'song_plays', amountCents: 995, plays: 5 },
  nwx_song_plays_10: { type: 'song_plays', amountCents: 1990, plays: 10 },
  nwx_song_plays_25: { type: 'song_plays', amountCents: 4975, plays: 25 },
  nwx_song_plays_50: { type: 'song_plays', amountCents: 9950, plays: 50 },
  nwx_song_plays_100: { type: 'song_plays', amountCents: 19900, plays: 100 },
  nwx_tip_199: { type: 'tip', amountCents: 199 },
  nwx_tip_499: { type: 'tip', amountCents: 499 },
  nwx_tip_999: { type: 'tip', amountCents: 999 },
  nwx_tip_2499: { type: 'tip', amountCents: 2499 },
  nwx_pro_networx_monthly: {
    type: 'pro_networx_subscription',
    amountCents: 999,
  },
};

export const PRO_NETWORX_MONTHLY_PRODUCT_ID = 'nwx_pro_networx_monthly';

export const TIP_PRODUCT_IDS_BY_CENTS: Record<number, string> = {
  199: 'nwx_tip_199',
  499: 'nwx_tip_499',
  999: 'nwx_tip_999',
  2499: 'nwx_tip_2499',
};
