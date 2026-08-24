import '../utils/mobile_store.dart';
import 'api_service.dart';
import 'pending_purchase_queue.dart';
import 'play_billing_service.dart';

class PaymentsService {
  final ApiService _api = ApiService();

  /// Redeems a completed store purchase, queueing it first so a failed or
  /// interrupted call can be retried instead of silently eating the payment.
  ///
  /// Callers should use this rather than the platform-specific `complete*`
  /// methods below.
  Future<Map<String, dynamic>> completeStorePurchase({
    required PlayPurchaseResult purchase,
    String? songId,
    String? sessionId,
    List<String>? customQuestions,
  }) async {
    final pending = PendingStorePurchase(
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
      appStore: isAppStorePlatform,
      createdAtMs: DateTime.now().millisecondsSinceEpoch,
      transactionId: purchase.transactionId,
      songId: songId,
      sessionId: sessionId,
      customQuestions: customQuestions,
    );
    await PendingPurchaseQueue.instance.add(pending);

    final result = isAppStorePlatform
        ? await completeAppStorePurchase(
            productId: purchase.productId,
            signedTransaction: purchase.purchaseToken,
            transactionId: purchase.transactionId,
            songId: songId,
            sessionId: sessionId,
            customQuestions: customQuestions,
          )
        : await completeGooglePlayPurchase(
            productId: purchase.productId,
            purchaseToken: purchase.purchaseToken,
            songId: songId,
            sessionId: sessionId,
            customQuestions: customQuestions,
          );

    await PendingPurchaseQueue.instance.remove(pending.id);
    return result;
  }

  Future<Map<String, dynamic>> getSongPlayPrice(String songId) async {
    final res = await _api.get(
      'payments/song-play-price?songId=${Uri.encodeComponent(songId)}',
    );
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> createIntent({
    required int amountCents,
    int? credits,
  }) async {
    final res = await _api.post('payments/create-intent', {
      'amount': amountCents,
      if (credits != null) 'credits': credits,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> createIntentSongPlays({
    required String songId,
    required int plays,
  }) async {
    final res = await _api.post('payments/create-intent-song-plays', {
      'songId': songId,
      'plays': plays,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> createCheckoutSessionSongPlays({
    required String songId,
    required int plays,
    String? successUrl,
    String? cancelUrl,
  }) async {
    final res = await _api.post('payments/checkout-session-song-plays', {
      'songId': songId,
      'plays': plays,
      if (successUrl != null) 'successUrl': successUrl,
      if (cancelUrl != null) 'cancelUrl': cancelUrl,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> quickAddMinutes({
    required String songId,
    int minutes = 5,
    String? successUrl,
    String? cancelUrl,
  }) async {
    final res = await _api.post('payments/quick-add-minutes', {
      'songId': songId,
      'minutes': minutes,
      if (successUrl != null) 'successUrl': successUrl,
      if (cancelUrl != null) 'cancelUrl': cancelUrl,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> createCreatorNetworkCheckoutSession({
    String? successUrl,
    String? cancelUrl,
  }) async {
    final res = await _api.post('payments/create-creator-network-checkout-session', {
      if (successUrl != null) 'successUrl': successUrl,
      if (cancelUrl != null) 'cancelUrl': cancelUrl,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> completeGooglePlayPurchase({
    required String productId,
    required String purchaseToken,
    String? songId,
    String? sessionId,
    List<String>? customQuestions,
  }) async {
    final res = await _api.post('payments/google-play/complete', {
      'productId': productId,
      'purchaseToken': purchaseToken,
      if (songId != null) 'songId': songId,
      if (sessionId != null) 'sessionId': sessionId,
      if (customQuestions != null) 'customQuestions': customQuestions,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> completeAppStorePurchase({
    required String productId,
    String? signedTransaction,
    String? transactionId,
    String? songId,
    String? sessionId,
    List<String>? customQuestions,
  }) async {
    final res = await _api.post('payments/app-store/complete', {
      'productId': productId,
      if (signedTransaction != null && signedTransaction.isNotEmpty)
        'signedTransaction': signedTransaction,
      if (transactionId != null && transactionId.isNotEmpty)
        'transactionId': transactionId,
      if (songId != null) 'songId': songId,
      if (sessionId != null) 'sessionId': sessionId,
      if (customQuestions != null) 'customQuestions': customQuestions,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> completeAppStoreSubscription({
    required String productId,
    String? signedTransaction,
    String? transactionId,
  }) async {
    final res = await _api.post('payments/app-store/complete-subscription', {
      'productId': productId,
      if (signedTransaction != null && signedTransaction.isNotEmpty)
        'signedTransaction': signedTransaction,
      if (transactionId != null && transactionId.isNotEmpty)
        'transactionId': transactionId,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> completeGooglePlaySubscription({
    required String productId,
    required String purchaseToken,
  }) async {
    final res = await _api.post('payments/google-play/complete-subscription', {
      'productId': productId,
      'purchaseToken': purchaseToken,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> buySong({
    required String songId,
    String? successUrl,
    String? cancelUrl,
  }) async {
    final res = await _api.post('payments/songs/$songId/checkout', {
      if (successUrl != null) 'successUrl': successUrl,
      if (cancelUrl != null) 'cancelUrl': cancelUrl,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> getConnectStatus() async {
    final res = await _api.get('payments/connect/status');
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> startConnectOnboarding({
    String? returnUrl,
    String? refreshUrl,
  }) async {
    final res = await _api.post('payments/connect/onboard', {
      if (returnUrl != null) 'returnUrl': returnUrl,
      if (refreshUrl != null) 'refreshUrl': refreshUrl,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> createConnectLoginLink() async {
    final res = await _api.post('payments/connect/login-link', {});
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }
}
