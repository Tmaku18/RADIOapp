import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

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

  Future<String> uploadPhoto(File file) async {
    String contentType;
    final lowerPath = file.path.toLowerCase();
    if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (lowerPath.endsWith('.png')) {
      contentType = 'image/png';
    } else if (lowerPath.endsWith('.webp')) {
      contentType = 'image/webp';
    } else {
      throw Exception('Please choose a JPEG, PNG, or WebP image.');
    }
    final parts = contentType.split('/');
    final multipartFile = await http.MultipartFile.fromPath(
      'file',
      file.path,
      contentType: MediaType(parts[0], parts[1]),
    );
    final res = await _api.postMultipart(
      'studios/photos',
      const {},
      [multipartFile],
    );
    if (res is Map) {
      final url = (res['url'] ?? '').toString().trim();
      if (url.isNotEmpty) return url;
    }
    throw Exception('Failed to upload studio photo');
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
