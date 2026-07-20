import 'api_service.dart';

class NearbyService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> listPeople({
    double? lat,
    double? lng,
    double? radiusKm,
    String? search,
    String? location,
    String role = 'service_provider',
    int limit = 50,
    int offset = 0,
  }) async {
    final q = <String>[
      'role=$role',
      'limit=$limit',
      'offset=$offset',
      if (lat != null) 'lat=$lat',
      if (lng != null) 'lng=$lng',
      if (radiusKm != null) 'radiusKm=$radiusKm',
      if (search != null && search.trim().isNotEmpty)
        'search=${Uri.encodeQueryComponent(search.trim())}',
      if (location != null && location.trim().isNotEmpty)
        'location=${Uri.encodeQueryComponent(location.trim())}',
    ].join('&');
    final res = await _api.get('discovery/people?$q');
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
