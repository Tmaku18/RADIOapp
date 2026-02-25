import 'api_service.dart';

class LivestreamService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>?> getStatus(String artistId) async {
    final data = await _api.get('artist-live/$artistId/status');
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> getWatch(String artistId) async {
    final data = await _api.get('artist-live/$artistId/watch');
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> start({String? title, String? description, String? category}) async {
    final data = await _api.post('artist-live/start', {
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      if (category != null) 'category': category,
    });
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> stop() async {
    final data = await _api.post('artist-live/stop', {});
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> join(String sessionId, {String source = 'mobile_watch'}) async {
    final data = await _api.post('artist-live/$sessionId/join', {'source': source});
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> createDonationIntent(String sessionId, int amountCents, {String? message}) async {
    final data = await _api.post('artist-live/$sessionId/donations/intent', {
      'amountCents': amountCents,
      if (message != null && message.trim().isNotEmpty) 'message': message.trim(),
    });
    return data is Map<String, dynamic> ? data : null;
  }
}

