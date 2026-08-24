import 'dart:io';

import 'package:url_launcher/url_launcher.dart';

import '../utils/mobile_store.dart';
import 'payments_service.dart';
import 'play_billing_service.dart';
import 'refinery_service.dart';

/// Submits a song to The Refinery via free add, store IAP, or web Stripe.
class RefinerySubmissionFlow {
  RefinerySubmissionFlow._();

  static final RefineryService _refinery = RefineryService();
  static final PaymentsService _payments = PaymentsService();

  /// Returns true when the song is now in The Refinery (store / free paths).
  /// Web Stripe returns false — enrollment lands via webhook after checkout.
  static Future<bool> submit({
    required String songId,
    List<String> customQuestions = const [],
    bool submissionFree = false,
  }) async {
    if (submissionFree) {
      await _refinery.addSongToRefinery(
        songId,
        customQuestions: customQuestions,
      );
      return true;
    }

    if (isMobileStorePlatform) {
      return _submitWithStore(
        songId: songId,
        customQuestions: customQuestions,
      );
    }

    await _submitWithStripeCheckout(
      songId: songId,
      customQuestions: customQuestions,
    );
    return false;
  }

  static Future<bool> _submitWithStore({
    required String songId,
    required List<String> customQuestions,
  }) async {
    final productId = PlayBillingService.instance.refinerySubmissionProductId;
    final purchase =
        await PlayBillingService.instance.buyConsumable(productId);
    if (Platform.isIOS) {
      await _payments.completeAppStorePurchase(
        productId: purchase.productId,
        signedTransaction: purchase.purchaseToken,
        transactionId: purchase.transactionId,
        songId: songId,
        customQuestions: customQuestions,
      );
    } else {
      await _payments.completeGooglePlayPurchase(
        productId: purchase.productId,
        purchaseToken: purchase.purchaseToken,
        songId: songId,
        customQuestions: customQuestions,
      );
    }
    return true;
  }

  static Future<void> _submitWithStripeCheckout({
    required String songId,
    required List<String> customQuestions,
  }) async {
    final res = await _refinery.createSubmissionCheckout(
      songId,
      customQuestions: customQuestions,
    );
    final url = (res['url'] ?? res['checkoutUrl'])?.toString();
    if (url == null || url.isEmpty) {
      throw Exception('Could not start Refinery checkout.');
    }
    final uri = Uri.tryParse(url);
    if (uri == null) throw Exception('Invalid checkout URL.');
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) throw Exception('Could not open checkout.');
  }
}
