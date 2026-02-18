import '../models/discovery_profile.dart';
import 'api_service.dart';

class DiscoveryService {
  final ApiService _api = ApiService();

  Future<List<DiscoveryProfile>> listPeople({
    String role = 'service_provider',
    String? serviceType,
    String? location,
    String? search,
    int? minRateCents,
    int? maxRateCents,
    double? lat,
    double? lng,
    double? radiusKm,
    int limit = 30,
    int offset = 0,
  }) async {
    final params = <String, String>{
      'role': role,
      'limit': '$limit',
      'offset': '$offset',
      if (serviceType != null && serviceType.isNotEmpty) 'serviceType': serviceType,
      if (location != null && location.isNotEmpty) 'location': location,
      if (search != null && search.isNotEmpty) 'search': search,
      if (minRateCents != null) 'minRateCents': '$minRateCents',
      if (maxRateCents != null) 'maxRateCents': '$maxRateCents',
      if (lat != null) 'lat': '$lat',
      if (lng != null) 'lng': '$lng',
      if (radiusKm != null) 'radiusKm': '$radiusKm',
    };
    final q = params.entries.map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}').join('&');
    final res = await _api.get('discovery/people?$q');
    if (res is Map<String, dynamic>) {
      final items = res['items'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => DiscoveryProfile.fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
            .toList();
      }
    }
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => DiscoveryProfile.fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    return const [];
  }
}

