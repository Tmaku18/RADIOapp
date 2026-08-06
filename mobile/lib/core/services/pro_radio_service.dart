import '../models/pro_radio_models.dart';
import 'api_service.dart';

class ProRadioService {
  final ApiService _api = ApiService();

  Future<ProRadioAccess> getAccess() async {
    final res = await _api.get('pro-radio-subscription/access');
    if (res is Map<String, dynamic>) return ProRadioAccess.fromJson(res);
    return const ProRadioAccess(
      hasAccess: false,
      status: null,
      currentPeriodEnd: null,
      regularCents: 999,
      introCents: 499,
    );
  }

  Future<Map<String, dynamic>> createPaymentSheet() async {
    final res = await _api.post('payments/create-pro-radio-payment-sheet', {});
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> createCheckoutSession({
    String? successUrl,
    String? cancelUrl,
  }) async {
    final res = await _api.post('payments/create-pro-radio-checkout-session', {
      if (successUrl != null) 'successUrl': successUrl,
      if (cancelUrl != null) 'cancelUrl': cancelUrl,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<List<ProRadioPlaylist>> listPlaylists() async {
    final res = await _api.get('playlists/mine');
    final list = (res is Map ? res['playlists'] : null);
    if (list is! List) return const [];
    return list
        .whereType<Map>()
        .map((e) => ProRadioPlaylist.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<ProRadioPlaylist> createPlaylist(String title) async {
    final res = await _api.post('playlists', {'title': title});
    return ProRadioPlaylist.fromJson(
      (res is Map<String, dynamic>) ? res : <String, dynamic>{},
    );
  }

  Future<List<ProRadioPlaylistTrack>> getPlaylistTracks(String id) async {
    final res = await _api.get('playlists/$id/tracks');
    final list = (res is Map ? res['tracks'] : null);
    if (list is! List) return const [];
    return list
        .whereType<Map>()
        .map(
          (e) => ProRadioPlaylistTrack.fromJson(Map<String, dynamic>.from(e)),
        )
        .toList();
  }

  Future<void> addTrack(String playlistId, String songId) async {
    await _api.post('playlists/$playlistId/tracks', {'songId': songId});
  }

  Future<void> removeTrack(String playlistId, String songId) async {
    await _api.delete('playlists/$playlistId/tracks/$songId');
  }
}
