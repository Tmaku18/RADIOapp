import '../models/discover_audio_models.dart';
import 'api_service.dart';

class DiscoverAudioService {
  final ApiService _api = ApiService();

  Future<DiscoverAudioFeedPage> getFeed({
    int limit = 12,
    String? cursor,
    String? seed,
    String? stationId,
  }) async {
    final q = <String>[
      'limit=$limit',
      if (cursor != null && cursor.isNotEmpty) 'cursor=$cursor',
      if (seed != null && seed.isNotEmpty) 'seed=$seed',
      if (stationId != null && stationId.isNotEmpty) 'stationId=$stationId',
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
    String? stationId,
  }) async {
    await _api.post('songs/discover/swipe', {
      'songId': songId,
      'direction': direction,
      if (decisionMs != null) 'decisionMs': decisionMs,
      if (stationId != null && stationId.isNotEmpty) 'stationId': stationId,
    });
  }

  Future<List<DiscoverAudioLikedItem>> getLikedList({
    int limit = 100,
    int offset = 0,
  }) async {
    final safeLimit = limit.clamp(1, 200);
    final safeOffset = offset < 0 ? 0 : offset;
    final res = await _api.get(
      'songs/discover/list?limit=$safeLimit&offset=$safeOffset',
    );
    if (res is! Map<String, dynamic>) return const <DiscoverAudioLikedItem>[];
    final raw = (res['items'] as List?) ?? const [];
    return raw
        .whereType<Map>()
        .map(
          (e) => DiscoverAudioLikedItem.fromJson(
            e.map((k, v) => MapEntry(k.toString(), v)),
          ),
        )
        .toList();
  }

  /// Artist profiles for songs you've liked (Discover Artists tab).
  Future<List<DiscoverLikedArtist>> getLikedArtists({
    int limit = 50,
    int offset = 0,
  }) async {
    final safeLimit = limit.clamp(1, 100);
    final safeOffset = offset < 0 ? 0 : offset;
    final res = await _api.get(
      'songs/discover/liked-artists?limit=$safeLimit&offset=$safeOffset',
    );
    if (res is! Map<String, dynamic>) return const <DiscoverLikedArtist>[];
    final raw = (res['items'] as List?) ?? const [];
    return raw
        .whereType<Map>()
        .map(
          (e) => DiscoverLikedArtist.fromJson(
            e.map((k, v) => MapEntry(k.toString(), v)),
          ),
        )
        .toList();
  }

  /// Liked (`right_like`) or disliked (`left_skip`) Discover history.
  Future<List<DiscoverAudioHistoryItem>> getHistory({
    required String direction,
    int limit = 100,
    int offset = 0,
  }) async {
    final safeLimit = limit.clamp(1, 200);
    final safeOffset = offset < 0 ? 0 : offset;
    final res = await _api.get(
      'songs/discover/history?direction=${Uri.encodeQueryComponent(direction)}'
      '&limit=$safeLimit&offset=$safeOffset',
    );
    if (res is! Map<String, dynamic>) {
      return const <DiscoverAudioHistoryItem>[];
    }
    final raw = (res['items'] as List?) ?? const [];
    return raw
        .whereType<Map>()
        .map(
          (e) => DiscoverAudioHistoryItem.fromJson(
            e.map((k, v) => MapEntry(k.toString(), v)),
          ),
        )
        .toList();
  }

  Future<void> removeLikedSong(String songId) async {
    await _api.delete('songs/discover/list/$songId');
  }

  Future<void> clearLikedList() async {
    await _api.delete('songs/discover/list');
  }

  /// Remove a swipe so the song can appear in Discover again.
  Future<void> removeSwipe(String songId) async {
    await _api.delete('songs/discover/swipes/$songId');
  }
}
