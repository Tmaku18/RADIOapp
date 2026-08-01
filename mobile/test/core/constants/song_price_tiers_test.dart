import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/constants/song_price_tiers.dart';
import 'package:radio_app/core/services/play_billing_service.dart';

void main() {
  group('snapToSongPriceTier', () {
    test('leaves prices that already sit on a tier alone', () {
      for (final tier in kSongPriceTiersCents) {
        expect(snapToSongPriceTier(tier), tier);
      }
    });

    test('clamps below the floor and above the ceiling', () {
      expect(snapToSongPriceTier(0), kMinSongPriceCents);
      expect(snapToSongPriceTier(50), kMinSongPriceCents);
      expect(snapToSongPriceTier(999999), kMaxSongPriceCents);
    });

    test('rounds to the nearest tier', () {
      expect(snapToSongPriceTier(120), 99);
      expect(snapToSongPriceTier(180), 199);
      expect(snapToSongPriceTier(750), 999);
      expect(snapToSongPriceTier(600), 499);
    });

    test('resolves an exact midpoint downward so buyers never pay more', () {
      // Halfway between 99 and 199.
      expect(snapToSongPriceTier(149), 99);
      // Halfway between 999 and 1999.
      expect(snapToSongPriceTier(1499), 999);
    });

    test('every tier is a distinct, ascending value', () {
      expect(kSongPriceTiersCents.toSet().length, kSongPriceTiersCents.length);
      final sorted = [...kSongPriceTiersCents]..sort();
      expect(kSongPriceTiersCents, sorted);
    });
  });

  group('songPurchaseProductIdForCents', () {
    final billing = PlayBillingService.instance;

    test('maps each tier to its documented SKU', () {
      expect(billing.songPurchaseProductIdForCents(99), 'nwx_song_099');
      expect(billing.songPurchaseProductIdForCents(199), 'nwx_song_199');
      expect(billing.songPurchaseProductIdForCents(299), 'nwx_song_299');
      expect(billing.songPurchaseProductIdForCents(499), 'nwx_song_499');
      expect(billing.songPurchaseProductIdForCents(999), 'nwx_song_999');
      expect(billing.songPurchaseProductIdForCents(1999), 'nwx_song_1999');
      expect(billing.songPurchaseProductIdForCents(2999), 'nwx_song_2999');
      expect(billing.songPurchaseProductIdForCents(4999), 'nwx_song_4999');
    });

    test('snaps an off-ladder price onto a registered SKU', () {
      expect(billing.songPurchaseProductIdForCents(750), 'nwx_song_999');
      expect(billing.songPurchaseProductIdForCents(1), 'nwx_song_099');
    });

    test('every tier SKU is unique', () {
      final ids = kSongPriceTiersCents
          .map(billing.songPurchaseProductIdForCents)
          .toSet();
      expect(ids.length, kSongPriceTiersCents.length);
    });

    test('tier SKUs are all registered for store product queries', () {
      final known = billing.allKnownProductIds;
      for (final cents in kSongPriceTiersCents) {
        expect(known, contains(billing.songPurchaseProductIdForCents(cents)));
      }
    });
  });
}
