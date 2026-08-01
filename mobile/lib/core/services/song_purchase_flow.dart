import 'dart:io';

import 'package:url_launcher/url_launcher.dart';

import '../constants/song_price_tiers.dart';
import '../utils/mobile_store.dart';
import 'payments_service.dart';
import 'play_billing_service.dart';

/// Outcome of a song/beat purchase attempt.
class SongPurchaseOutcome {
  const SongPurchaseOutcome._({
    required this.unlocked,
    required this.message,
  });

  /// The buyer owns the song now. Only true for the store path — the web path
  /// finishes in a browser, so ownership arrives later via webhook.
  final bool unlocked;

  /// User-facing text for a snackbar.
  final String message;

  const SongPurchaseOutcome.unlocked(String message)
      : this._(unlocked: true, message: message);

  const SongPurchaseOutcome.pendingInBrowser(String message)
      : this._(unlocked: false, message: message);
}

/// Buys a song or beat on whichever rail the current platform is allowed to use.
///
/// On iOS/Android this must go through App Store / Google Play, so we sell a
/// consumable from the fixed price ladder and let the backend verify the receipt
/// and record ownership. Everywhere else (web) it stays on Stripe Checkout.
///
/// Shared by the player, artist profile, and beat marketplace.
class SongPurchaseFlow {
  SongPurchaseFlow._();

  static final PaymentsService _payments = PaymentsService();

  /// Throws with a user-facing message when the purchase cannot be completed.
  static Future<SongPurchaseOutcome> buy({
    required String songId,
    required int priceCents,
  }) async {
    if (isMobileStorePlatform) {
      return _buyWithStore(songId: songId, priceCents: priceCents);
    }
    return _buyWithStripeCheckout(songId: songId);
  }

  static Future<SongPurchaseOutcome> _buyWithStore({
    required String songId,
    required int priceCents,
  }) async {
    final tierCents = snapToSongPriceTier(priceCents);
    final productId = PlayBillingService.instance.songPurchaseProductIdForCents(
      tierCents,
    );

    final purchase = await PlayBillingService.instance.buyConsumable(productId);
    if (Platform.isIOS) {
      await _payments.completeAppStorePurchase(
        productId: purchase.productId,
        signedTransaction: purchase.purchaseToken,
        transactionId: purchase.transactionId,
        songId: songId,
      );
    } else {
      await _payments.completeGooglePlayPurchase(
        productId: purchase.productId,
        purchaseToken: purchase.purchaseToken,
        songId: songId,
      );
    }
    return const SongPurchaseOutcome.unlocked('Purchased. Enjoy the full track!');
  }

  static Future<SongPurchaseOutcome> _buyWithStripeCheckout({
    required String songId,
  }) async {
    final res = await _payments.buySong(songId: songId);
    final url = (res['url'] ?? res['checkoutUrl'])?.toString();
    if (url == null || url.isEmpty) {
      throw Exception('Could not start checkout.');
    }
    final uri = Uri.tryParse(url);
    if (uri == null) throw Exception('Invalid checkout URL.');
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) throw Exception('Could not open checkout.');
    return const SongPurchaseOutcome.pendingInBrowser(
      'Complete your purchase in the browser. '
      'Your song unlocks once payment finishes.',
    );
  }
}
