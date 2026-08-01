/// Fixed price ladder for song and beat sales.
///
/// App Store and Google Play can only sell pre-registered products at fixed
/// prices, so artist-set prices are snapped onto this ladder and every tier has
/// a matching consumable SKU. Keep in sync with
/// `backend/src/payments/song-price-tiers.ts` and the products created in both
/// consoles (see `mobile/docs/APP_STORE_IAP.md`).
library;

const List<int> kSongPriceTiersCents = [
  99,
  199,
  299,
  499,
  999,
  1999,
  2999,
  4999,
];

const int kDefaultSongPriceCents = 99;
const int kDefaultBeatPriceCents = 999;

int get kMinSongPriceCents => kSongPriceTiersCents.first;
int get kMaxSongPriceCents => kSongPriceTiersCents.last;

bool isSongPriceTier(int cents) => kSongPriceTiersCents.contains(cents);

/// Snap an arbitrary price onto the nearest tier. Ties resolve downward so a
/// price sitting exactly between two tiers never silently costs buyers more.
int snapToSongPriceTier(int cents) {
  if (cents <= kMinSongPriceCents) return kMinSongPriceCents;
  if (cents >= kMaxSongPriceCents) return kMaxSongPriceCents;

  var best = kSongPriceTiersCents.first;
  var bestDistance = (best - cents).abs();
  for (final tier in kSongPriceTiersCents) {
    final distance = (tier - cents).abs();
    if (distance < bestDistance) {
      best = tier;
      bestDistance = distance;
    }
  }
  return best;
}

String formatSongPrice(int cents) => '\$${(cents / 100).toStringAsFixed(2)}';
