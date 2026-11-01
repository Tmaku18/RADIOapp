import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';

class GrowthService {
  GrowthService({ApiService? api}) : _api = api ?? ApiService();

  final ApiService _api;
  static const _favoritesKey = 'offline_favorites_v1';

  Future<Map<String, dynamic>> search(String query) async {
    final res = await _api.get('growth/search?q=${Uri.encodeQueryComponent(query)}');
    if (res is Map<String, dynamic>) return res;
    return {'songs': [], 'people': []};
  }

  Future<Map<String, dynamic>> referralProfile() async {
    final res = await _api.get('growth/referrals/me');
    if (res is Map<String, dynamic>) return res;
    return {};
  }

  Future<void> claimReferral(String code) async {
    await _api.post('growth/referrals/claim', {'code': code});
  }

  Future<Map<String, dynamic>> notificationPrefs() async {
    final res = await _api.get('growth/notifications');
    if (res is Map<String, dynamic>) return res;
    return {};
  }

  Future<Map<String, dynamic>> updateNotificationPrefs(
    Map<String, dynamic> patch,
  ) async {
    final res = await _api.patch('growth/notifications', patch);
    if (res is Map<String, dynamic>) return res;
    return {};
  }

  Future<List<Map<String, dynamic>>> history() async {
    final res = await _api.get('growth/history');
    if (res is List) {
      return res.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  Future<void> recordListen({
    String? songId,
    required String title,
    String? artistName,
    String? artworkUrl,
  }) async {
    try {
      await _api.post('growth/history', {
        if (songId != null) 'songId': songId,
        'title': title,
        if (artistName != null) 'artistName': artistName,
        if (artworkUrl != null) 'artworkUrl': artworkUrl,
      });
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> refreshFavorites() async {
    final res = await _api.get('growth/favorites');
    final list = res is List
        ? res.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
        : <Map<String, dynamic>>[];
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_favoritesKey, jsonEncode(list));
    return list;
  }

  Future<List<Map<String, dynamic>>> cachedFavorites() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_favoritesKey);
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }
}
