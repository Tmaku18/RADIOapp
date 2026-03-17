import '../models/pro_networx_models.dart';
import 'api_service.dart';

class ProNetworxService {
  final ApiService _api = ApiService();

  Future<ProProfile> getMeProfile() async {
    final res = await _api.get('pro-networx/me/profile');
    if (res is Map<String, dynamic>) return ProProfile.fromJson(res);
    throw Exception('Failed to load Pro profile');
  }

  Future<ProProfile> updateMeProfile({
    bool? availableForWork,
    String? skillsHeadline,
    List<String>? skillNames,
  }) async {
    final res = await _api.put('pro-networx/me/profile', {
      if (availableForWork != null) 'availableForWork': availableForWork,
      if (skillsHeadline != null) 'skillsHeadline': skillsHeadline,
      if (skillNames != null) 'skillNames': skillNames,
    });
    if (res is Map<String, dynamic>) return ProProfile.fromJson(res);
    throw Exception('Failed to update Pro profile');
  }

  Future<List<ProDirectoryItem>> listDirectory({
    String? skill,
    bool? availableForWork,
    String? search,
    String? location,
    String? sort,
  }) async {
    final params = <String, String>{
      if (skill != null && skill.trim().isNotEmpty) 'skill': skill.trim(),
      if (availableForWork != null) 'availableForWork': availableForWork ? 'true' : 'false',
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (location != null && location.trim().isNotEmpty) 'location': location.trim(),
      if (sort != null && sort.trim().isNotEmpty) 'sort': sort.trim(),
    };
    final q = params.entries
        .map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}')
        .join('&');
    final res = await _api.get('pro-networx/directory${q.isEmpty ? '' : '?$q'}');
    if (res is Map<String, dynamic>) {
      final items = res['items'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => ProDirectoryItem.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v))))
            .toList();
      }
    }
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => ProDirectoryItem.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    return const [];
  }

  Future<Map<String, dynamic>> getProfileByUserId(String userId) async {
    final res = await _api.get('pro-networx/profiles/$userId');
    if (res is Map<String, dynamic>) return res;
    throw Exception('Failed to load Pro profile');
  }

  Future<Map<String, dynamic>> getAccess() async {
    final res = await _api.get('creator-network/access');
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> getFeed({
    int limit = 20,
    String? cursor,
  }) async {
    final q = <String>[
      'limit=$limit',
      if (cursor != null && cursor.isNotEmpty) 'cursor=${Uri.encodeComponent(cursor)}',
    ].join('&');
    final res = await _api.get('pro-networx/feed?$q');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => e.map((k, v) => MapEntry(k.toString(), v)))
          .toList();
    }
    if (res is Map<String, dynamic> && res['items'] is List) {
      final raw = res['items'] as List;
      return raw
          .whereType<Map>()
          .map((e) => e.map((k, v) => MapEntry(k.toString(), v)))
          .toList();
    }
    return const [];
  }
}

