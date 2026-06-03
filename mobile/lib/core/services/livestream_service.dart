import 'api_service.dart';

class LivestreamService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>?> getStreamerStatus() async {
    final data = await _api.get('artist-live/streamer-status');
    return data is Map<String, dynamic> ? data : null;
  }

  Future<bool> applyToStream() async {
    final data = await _api.post('artist-live/apply', {});
    return data is Map<String, dynamic> && (data['applied'] == true);
  }

  Future<Map<String, dynamic>?> getStatus(String artistId) async {
    final data = await _api.get('artist-live/$artistId/status');
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> getWatch(String artistId) async {
    final data = await _api.get('artist-live/$artistId/watch');
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> start({String? title, String? description, String? category, String? hostType}) async {
    final data = await _api.post('artist-live/start', {
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      if (category != null) 'category': category,
      if (hostType != null) 'hostType': hostType,
    });
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> stop() async {
    final data = await _api.post('artist-live/stop', {});
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> join(String sessionId, {String source = 'mobile_watch', String? viewerToken}) async {
    final data = await _api.post('artist-live/$sessionId/join', {
      'source': source,
      if (viewerToken != null) 'viewerToken': viewerToken,
    });
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> heartbeat(String sessionId, String viewerId) async {
    final data = await _api.post('artist-live/$sessionId/heartbeat', {'viewerId': viewerId});
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> leave(String sessionId, String viewerId) async {
    final data = await _api.post('artist-live/$sessionId/leave', {'viewerId': viewerId});
    return data is Map<String, dynamic> ? data : null;
  }

  Future<Map<String, dynamic>?> createDonationIntent(String sessionId, int amountCents, {String? message}) async {
    final data = await _api.post('artist-live/$sessionId/donations/intent', {
      'amountCents': amountCents,
      if (message != null && message.trim().isNotEmpty) 'message': message.trim(),
    });
    return data is Map<String, dynamic> ? data : null;
  }

  /// Recent live-chat messages. Pass [after] (ISO timestamp) to fetch only
  /// messages newer than the last one you've seen (polling).
  Future<List<Map<String, dynamic>>> listChat(
    String sessionId, {
    String? after,
    int? limit,
  }) async {
    final params = <String>[];
    if (after != null && after.isNotEmpty) {
      params.add('after=${Uri.encodeQueryComponent(after)}');
    }
    if (limit != null) params.add('limit=$limit');
    final query = params.isEmpty ? '' : '?${params.join('&')}';
    final data = await _api.get('artist-live/$sessionId/chat$query');
    final messages = data is Map<String, dynamic> ? data['messages'] : null;
    if (messages is List) {
      return messages
          .whereType<Map<String, dynamic>>()
          .toList(growable: false);
    }
    return const [];
  }

  Future<Map<String, dynamic>?> postChat(
      String sessionId, String message) async {
    final data = await _api.post('artist-live/$sessionId/chat', {
      'message': message,
    });
    return data is Map<String, dynamic> ? data : null;
  }

  Future<bool> deleteChat(String sessionId, String messageId) async {
    final data =
        await _api.post('artist-live/$sessionId/chat/$messageId/delete', {});
    return data is Map<String, dynamic> && data['deleted'] == true;
  }
}

