import '../models/discover_audio_models.dart';
import 'api_service.dart';

class DiscoverAudioService {
  final ApiService _api = ApiService();

  Future<DiscoverAudioFeedPage> getFeed({
    int limit = 12,
    String? cursor,
    String? seed,
  }) async {
    final q = <String>[
      'limit=$limit',
      if (cursor != null && cursor.isNotEmpty) 'cursor=$cursor',
      if (seed != null && seed.isNotEmpty) 'seed=$seed',
    ].join('&');
    final res = await _api.get('songs/discover/feed?$q');
    if (res is Map<String, dynamic>) {
      return DiscoverAudioFeedPage.fromJson(res);
    }
    return const DiscoverAudioFeedPage(items: [], nextCursor: null);
  }

  Future<void> swipe({
    required String songId,
    required String direction,
    int? decisionMs,
  }) async {
    await _api.post('songs/discover/swipe', {
      'songId': songId,
      'direction': direction,
      if (decisionMs != null) 'decisionMs': decisionMs,
    });
  }
}
