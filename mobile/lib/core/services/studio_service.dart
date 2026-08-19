import '../models/studio_models.dart';
import 'api_service.dart';

class StudioService {
  final ApiService _api = ApiService();

  Future<List<Studio>> list({
    String? search,
    String? city,
    double? lat,
    double? lng,
    double? radiusKm,
    int limit = 60,
  }) async {
    final q = <String>[
      'limit=$limit',
      if (search != null && search.trim().isNotEmpty)
        'search=${Uri.encodeQueryComponent(search.trim())}',
      if (city != null && city.trim().isNotEmpty)
        'city=${Uri.encodeQueryComponent(city.trim())}',
      if (lat != null) 'lat=$lat',
      if (lng != null) 'lng=$lng',
      if (radiusKm != null) 'radiusKm=$radiusKm',
    ].join('&');
    final res = await _api.get('studios?$q');
    final items = res is Map ? res['items'] : null;
    if (items is! List) return const [];
    return items
        .whereType<Map>()
        .map((e) => Studio.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Studio> getOne(String id) async {
    final res = await _api.get('studios/${Uri.encodeComponent(id)}');
    if (res is Map<String, dynamic>) return Studio.fromJson(res);
    throw Exception('Studio not found');
  }

  Future<List<Studio>> listMine() async {
    final res = await _api.get('studios/me');
    final items = res is Map ? res['items'] : null;
    if (items is! List) return const [];
    return items
        .whereType<Map>()
        .map((e) => Studio.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Studio> create(Map<String, dynamic> payload) async {
    final res = await _api.post('studios', payload);
    if (res is Map<String, dynamic>) return Studio.fromJson(res);
    throw Exception('Failed to create studio');
  }

  Future<Studio> update(String id, Map<String, dynamic> payload) async {
    final res = await _api.patch('studios/${Uri.encodeComponent(id)}', payload);
    if (res is Map<String, dynamic>) return Studio.fromJson(res);
    throw Exception('Failed to update studio');
  }

  Future<void> remove(String id) async {
    await _api.delete('studios/${Uri.encodeComponent(id)}');
  }

  Future<List<StudioMember>> searchPeople(String query) async {
    final q = query.trim();
    if (q.length < 2) return const [];
    final res = await _api.get(
      'studios/people-search?q=${Uri.encodeQueryComponent(q)}',
    );
    final items = res is Map ? res['items'] : null;
    if (items is! List) return const [];
    return items
        .whereType<Map>()
        .map((e) => StudioMember.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
