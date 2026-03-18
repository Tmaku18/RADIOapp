import 'api_service.dart';

class PaymentsService {
  final ApiService _api = ApiService();

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
  }) async {
    final res = await _api.post('payments/google-play/complete', {
      'productId': productId,
      'purchaseToken': purchaseToken,
      if (songId != null) 'songId': songId,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }
}
