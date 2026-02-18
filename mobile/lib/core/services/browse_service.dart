import '../models/browse_models.dart';
import 'api_service.dart';

class BrowseService {
  final ApiService _api = ApiService();

  Future<BrowseFeedPage> getFeed({
    int limit = 12,
    String? cursor,
    String? seed,
  }) async {
    final q = <String>[
      'limit=$limit',
      if (cursor != null) 'cursor=$cursor',
      if (seed != null) 'seed=$seed',
    ].join('&');
    final res = await _api.get('browse/feed?$q');
    if (res is Map<String, dynamic>) return BrowseFeedPage.fromJson(res);
    return const BrowseFeedPage(items: [], nextCursor: null);
  }

  Future<Map<String, dynamic>> toggleLike(String contentId) async {
    final res = await _api.post('browse/feed/$contentId/like', {});
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<void> addBookmark(String contentId) async {
    await _api.post('browse/feed/$contentId/bookmark', {});
  }

  Future<void> removeBookmark(String contentId) async {
    await _api.delete('browse/feed/$contentId/bookmark');
  }

  Future<void> report(String contentId, String reason) async {
    await _api.post('browse/feed/$contentId/report', {'reason': reason});
  }

  Future<List<BrowseFeedItem>> getBookmarks({int limit = 100}) async {
    final res = await _api.get('browse/bookmarks?limit=$limit');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => BrowseFeedItem.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v)),
              ))
          .toList();
    }
    return const [];
  }
}
