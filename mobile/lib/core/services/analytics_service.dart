import '../models/analytics_models.dart';
import 'api_service.dart';

class AnalyticsService {
  final ApiService _api = ApiService();

  Future<ArtistAnalytics?> getMyAnalytics({int days = 30}) async {
    final res = await _api.get('analytics/me?days=$days');
    if (res is Map<String, dynamic>) return ArtistAnalytics.fromJson(res);
    return null;
  }

  /// Fetch a single play's analytics (for "Your song has been played" notification).
  Future<Map<String, dynamic>?> getPlayById(String playId) async {
    final res = await _api.get('analytics/plays/$playId');
    if (res is Map<String, dynamic>) return res;
    return null;
  }

  Future<Map<String, dynamic>?> getMyRoi({int days = 30}) async {
    final res = await _api.get('analytics/me/roi?days=$days');
    if (res is Map<String, dynamic>) return res;
    return null;
  }

  Future<List<Map<String, dynamic>>> getMyPlaysByRegion({int days = 30}) async {
    final res = await _api.get('analytics/me/plays-by-region?days=$days');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => e.map((k, v) => MapEntry(k.toString(), v)))
          .toList();
    }
    return const [];
  }
}

