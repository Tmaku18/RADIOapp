import 'api_service.dart';

class NearbyService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> listPeople({
    required double lat,
    required double lng,
    required double radiusKm,
    String role = 'service_provider',
    int limit = 50,
    int offset = 0,
  }) async {
    final endpoint =
        'discovery/people?role=$role&lat=$lat&lng=$lng&radiusKm=$radiusKm&limit=$limit&offset=$offset';
    final res = await _api.get(endpoint);
    if (res is Map<String, dynamic>) return res;
    return <String, dynamic>{'items': <dynamic>[], 'total': 0};
  }

  /// City/ZIP directory + map pins (optional GPS radius).
  Future<Map<String, dynamic>> listDirectory({
    double? lat,
    double? lng,
    double? radiusKm,
    int limit = 200,
  }) async {
    final q = <String>[
      'limit=$limit',
      if (lat != null) 'lat=$lat',
      if (lng != null) 'lng=$lng',
      if (radiusKm != null) 'radiusKm=$radiusKm',
    ].join('&');
    final res = await _api.get('discovery/people/directory?$q');
    if (res is Map<String, dynamic>) return res;
    return <String, dynamic>{
      'items': <dynamic>[],
      'byCity': <dynamic>[],
      'byZip': <dynamic>[],
      'total': 0,
    };
  }
}
