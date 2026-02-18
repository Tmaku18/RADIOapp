import '../models/competition_models.dart';
import 'api_service.dart';

class CompetitionService {
  final ApiService _api = ApiService();

  Future<List<LeaderboardSong>> getLeaderboardSongs({
    required String by, // 'likes' | 'listens'
    int limit = 20,
  }) async {
    final res = await _api.get('leaderboard/songs?by=$by&limit=$limit');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => LeaderboardSong.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    if (res is Map<String, dynamic>) {
      final items = res['items'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => LeaderboardSong.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v))))
            .toList();
      }
    }
    return const [];
  }

  Future<List<LeaderboardSong>> getUpvotesPerMinute({
    int windowMinutes = 60,
    int limit = 20,
  }) async {
    final res = await _api.get(
      'leaderboard/upvotes-per-minute?windowMinutes=$windowMinutes&limit=$limit',
    );
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => LeaderboardSong.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    if (res is Map<String, dynamic>) {
      final items = res['items'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => LeaderboardSong.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v))))
            .toList();
      }
    }
    return const [];
  }

  Future<List<NewsItem>> getNewsPromotions({int limit = 10}) async {
    final res = await _api.get('feed/news-promotions?limit=$limit');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) =>
              NewsItem.fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    return const [];
  }

  Future<SpotlightToday?> getTodaySpotlight() async {
    final res = await _api.get('spotlight/today');
    if (res is Map<String, dynamic>) return SpotlightToday.fromJson(res);
    return null;
  }

  Future<List<SpotlightWeekDay>> getWeekSpotlight({String? start}) async {
    final q = start == null ? '' : '?start=$start';
    final res = await _api.get('spotlight/week$q');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => SpotlightWeekDay.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    return const [];
  }

  Future<CurrentWeek?> getCurrentWeek() async {
    final res = await _api.get('competition/current-week');
    if (res is Map<String, dynamic>) return CurrentWeek.fromJson(res);
    return null;
  }

  Future<void> vote(List<String> songIds) async {
    await _api.post('competition/vote', {'songIds': songIds});
  }

  Future<List<BrowseLeaderboardCategory>> getBrowseLeaderboard(
      {int limitPerCategory = 5}) async {
    final res =
        await _api.get('browse/leaderboard?limitPerCategory=$limitPerCategory');
    if (res is Map<String, dynamic>) {
      final cats = res['categories'];
      if (cats is List) {
        return cats
            .whereType<Map>()
            .map((e) => BrowseLeaderboardCategory.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v))))
            .toList();
      }
    }
    return const [];
  }
}

