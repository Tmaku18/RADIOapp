import '../models/discovery_map_models.dart';
import 'api_service.dart';

class DiscoveryMapService {
  final ApiService _api = ApiService();

  Future<List<DiscoveryMapHeatBucket>> getHeat({
    String? station,
    String role = 'artist',
  }) async {
    final q = <String>[
      if (station != null && station.trim().isNotEmpty) 'station=$station',
      'role=$role',
      'zoom=4',
      'minLat=24.5',
      'maxLat=49.5',
      'minLng=-125',
      'maxLng=-66',
    ].join('&');
    final res = await _api.get('discovery/map/heat?$q');
    if (res is Map<String, dynamic>) {
      final raw = (res['buckets'] as List?) ?? const [];
      return raw
          .whereType<Map>()
          .map((e) => DiscoveryMapHeatBucket.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v)),
              ))
          .toList();
    }
    return const [];
  }

  Future<List<DiscoveryMapCluster>> getClusters({
    String? station,
    String role = 'artist',
  }) async {
    final q = <String>[
      if (station != null && station.trim().isNotEmpty) 'station=$station',
      'role=$role',
      'zoom=4',
      'minLat=24.5',
      'maxLat=49.5',
      'minLng=-125',
      'maxLng=-66',
    ].join('&');
    final res = await _api.get('discovery/map/clusters?$q');
    if (res is Map<String, dynamic>) {
      final raw = (res['clusters'] as List?) ?? const [];
      return raw
          .whereType<Map>()
          .map((e) => DiscoveryMapCluster.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v)),
              ))
          .toList();
    }
    return const [];
  }

  Future<List<DiscoveryMapArtistMarker>> getArtists({
    required DiscoveryMapCluster cluster,
    String? station,
    String role = 'artist',
  }) async {
    final q = <String>[
      if (station != null && station.trim().isNotEmpty) 'station=$station',
      'role=$role',
      'clusterLat=${cluster.lat}',
      'clusterLng=${cluster.lng}',
      'clusterRadiusKm=${cluster.radiusKm}',
      'limit=100',
    ].join('&');
    final res = await _api.get('discovery/map/artists?$q');
    if (res is Map<String, dynamic>) {
      final raw = (res['items'] as List?) ?? const [];
      return raw
          .whereType<Map>()
          .map((e) => DiscoveryMapArtistMarker.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v)),
              ))
          .toList();
    }
    return const [];
  }
}
