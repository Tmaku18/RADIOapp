import 'dart:convert';
import '../models/admin_models.dart';
import 'api_service.dart';

class AdminService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> getAnalytics() async {
    final res = await _api.get('admin/analytics');
    if (res is Map<String, dynamic>) return res;
    return {};
  }

  Future<Map<String, dynamic>> getLiveStatus() async {
    final res = await _api.get('admin/live/status');
    if (res is Map<String, dynamic>) return res;
    return {'active': false};
  }

  Future<void> startLive() async {
    await _api.post('admin/live/start', {});
  }

  Future<void> stopLive() async {
    await _api.post('admin/live/stop', {});
  }

  Future<List<Map<String, dynamic>>> getSongs({
    String? status,
    String? search,
    String? sortBy,
    String? sortOrder,
    int? limit,
    int? offset,
  }) async {
    final queryParts = <String>[
      if (status != null && status.isNotEmpty) 'status=$status',
      if (search != null && search.isNotEmpty)
        'search=${Uri.encodeQueryComponent(search)}',
      if (sortBy != null && sortBy.isNotEmpty) 'sortBy=$sortBy',
      if (sortOrder != null && sortOrder.isNotEmpty) 'sortOrder=$sortOrder',
      if (limit != null) 'limit=$limit',
      if (offset != null) 'offset=$offset',
    ];
    final endpoint = queryParts.isEmpty
        ? 'admin/songs'
        : 'admin/songs?${queryParts.join('&')}';
    final res = await _api.get(endpoint);
    if (res is List) return _asMapList(res);
    return [];
  }

  Future<void> updateSongStatus(
    String id,
    String status, {
    String? reason,
  }) async {
    await _api.patch('admin/songs/$id', {
      'status': status,
      if (reason != null && reason.isNotEmpty) 'reason': reason,
    });
  }

  Future<void> updateSongMetadata(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _api.patch('admin/songs/$id/metadata', data);
  }

  Future<void> deleteSong(String id) async {
    await _api.delete('admin/songs/$id');
  }

  Future<void> trimSong(String id, int startSeconds, int endSeconds) async {
    await _api.post('admin/songs/$id/trim', {
      'startSeconds': startSeconds,
      'endSeconds': endSeconds,
    });
  }

  Future<void> toggleFreeRotation(String songId, bool enabled) async {
    await _api.patch('admin/free-rotation/songs/$songId', {'enabled': enabled});
  }

  Future<List<AdminRadio>> getRadios({String? state}) async {
    final endpoint = state == null || state.isEmpty
        ? 'admin/radios'
        : 'admin/radios?state=${Uri.encodeQueryComponent(state)}';
    final res = await _api.get(endpoint);
    if (res is! Map<String, dynamic>) return const [];
    final radios = (res['radios'] as List?) ?? const [];
    return radios
        .whereType<Map>()
        .map((r) => AdminRadio.fromJson(r.cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> getRadioQueue(String radioId, {int? limit}) async {
    final endpoint = limit == null
        ? 'admin/radios/$radioId/queue'
        : 'admin/radios/$radioId/queue?limit=$limit';
    final res = await _api.get(endpoint);
    if (res is Map<String, dynamic>) return res;
    return {};
  }

  Future<void> replaceRadioQueue(String radioId, List<String> stackIds) async {
    await _api.patch('admin/radios/$radioId/queue', {'stackIds': stackIds});
  }

  Future<void> skipRadioQueueTrack(String radioId) async {
    await _api.post('admin/radios/$radioId/queue/skip', {});
  }

  Future<void> removeRadioQueueEntry(
    String radioId, {
    int? position,
    String? stackId,
    String? songId,
    String? source,
  }) async {
    final query = <String>[
      if (position != null) 'position=$position',
      if (stackId != null && stackId.isNotEmpty) 'stackId=$stackId',
      if (songId != null && songId.isNotEmpty) 'songId=$songId',
      if (source != null && source.isNotEmpty) 'source=$source',
    ];
    if (query.isEmpty) return;
    await _api.delete('admin/radios/$radioId/queue?${query.join('&')}');
  }

  Future<List<Map<String, dynamic>>> getFallbackSongs([String? radio]) async {
    final endpoint = (radio == null || radio.isEmpty)
        ? 'admin/fallback-songs'
        : 'admin/fallback-songs?radio=${Uri.encodeQueryComponent(radio)}';
    final res = await _api.get(endpoint);
    if (res is List) return _asMapList(res);
    return [];
  }

  Future<List<Map<String, dynamic>>> getFallbackSongsGrouped() async {
    final res = await _api.get('admin/fallback-songs/grouped');
    if (res is! Map<String, dynamic>) return const [];
    final songs = (res['songs'] as List?) ?? const [];
    return _asMapList(songs);
  }

  Future<void> setFallbackSongRadios(String id, List<String> radioIds) async {
    await _api.patch('admin/fallback-songs/$id/radios', {'radioIds': radioIds});
  }

  Future<void> updateFallbackSongGroup(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _api.patch('admin/fallback-songs/$id/group', data);
  }

  Future<void> deleteFallbackSongGroup(String id) async {
    await _api.delete('admin/fallback-songs/$id/group');
  }

  Future<void> addFallbackSongFromUpload({
    required String title,
    required String artistName,
    required String audioPath,
    String? artworkPath,
    int? durationSeconds,
  }) async {
    await _api.post('admin/fallback-songs/from-upload', {
      'title': title,
      'artistName': artistName,
      'audioPath': audioPath,
      if (artworkPath != null && artworkPath.isNotEmpty) 'artworkPath': artworkPath,
      if (durationSeconds != null) 'durationSeconds': durationSeconds,
    });
  }

  Future<void> addFallbackSongFromSong(String songId, {String? radio}) async {
    final endpoint = (radio == null || radio.isEmpty)
        ? 'admin/fallback-songs/from-song/$songId'
        : 'admin/fallback-songs/from-song/$songId?radio=${Uri.encodeQueryComponent(radio)}';
    await _api.post(endpoint, {});
  }

  Future<List<Map<String, dynamic>>> getSongsInFreeRotation([String? radio]) async {
    final endpoint = (radio == null || radio.isEmpty)
        ? 'admin/free-rotation/songs'
        : 'admin/free-rotation/songs?radio=${Uri.encodeQueryComponent(radio)}';
    final res = await _api.get(endpoint);
    if (res is List) return _asMapList(res);
    return [];
  }

  Future<List<Map<String, dynamic>>> searchSongsForFreeRotation(String query) async {
    final res = await _api.get(
      'admin/free-rotation/search/songs?q=${Uri.encodeQueryComponent(query)}',
    );
    if (res is List) return _asMapList(res);
    return [];
  }

  Future<List<Map<String, dynamic>>> searchUsersForFreeRotation(String query) async {
    final res = await _api.get(
      'admin/free-rotation/search/users?q=${Uri.encodeQueryComponent(query)}',
    );
    if (res is List) return _asMapList(res);
    return [];
  }

  Future<List<Map<String, dynamic>>> getUserSongsForFreeRotation(String userId) async {
    final res = await _api.get('admin/free-rotation/users/$userId/songs');
    if (res is List) return _asMapList(res);
    return [];
  }

  Future<List<Map<String, dynamic>>> getSwipeCards({
    String? search,
    int? limit,
    int? offset,
  }) async {
    final query = <String>[
      if (search != null && search.isNotEmpty)
        'search=${Uri.encodeQueryComponent(search)}',
      if (limit != null) 'limit=$limit',
      if (offset != null) 'offset=$offset',
    ];
    final endpoint = query.isEmpty
        ? 'admin/swipe'
        : 'admin/swipe?${query.join('&')}';
    final res = await _api.get(endpoint);
    if (res is! Map<String, dynamic>) return const [];
    return _asMapList((res['items'] as List?) ?? const []);
  }

  Future<void> deleteSwipeClip(String songId) async {
    await _api.delete('admin/swipe/$songId/clip');
  }

  Future<List<Map<String, dynamic>>> getFeedMedia({bool reportedOnly = false}) async {
    final endpoint = reportedOnly
        ? 'admin/feed-media?reportedOnly=true'
        : 'admin/feed-media';
    final res = await _api.get(endpoint);
    if (res is List) return _asMapList(res);
    return [];
  }

  Future<void> removeFromFeed(String contentId) async {
    await _api.patch('admin/feed-media/$contentId/remove', {});
  }

  Future<void> deleteFeedMedia(String contentId) async {
    await _api.delete('admin/feed-media/$contentId');
  }

  Future<List<Map<String, dynamic>>> getUsers({
    String? role,
    String? search,
    String? sortBy,
    String? sortOrder,
    int? limit,
    int? offset,
  }) async {
    final query = <String>[
      if (role != null && role.isNotEmpty) 'role=$role',
      if (search != null && search.isNotEmpty)
        'search=${Uri.encodeQueryComponent(search)}',
      if (sortBy != null && sortBy.isNotEmpty) 'sortBy=$sortBy',
      if (sortOrder != null && sortOrder.isNotEmpty) 'sortOrder=$sortOrder',
      if (limit != null) 'limit=$limit',
      if (offset != null) 'offset=$offset',
    ];
    final endpoint = query.isEmpty
        ? 'admin/users'
        : 'admin/users?${query.join('&')}';
    final res = await _api.get(endpoint);
    if (res is List) return _asMapList(res);
    return [];
  }

  Future<Map<String, dynamic>> getUserProfile(String userId) async {
    final res = await _api.get('admin/users/$userId');
    if (res is Map<String, dynamic>) return res;
    return {};
  }

  Future<void> updateUserRole(String userId, String role) async {
    await _api.patch('admin/users/$userId/role', {'role': role});
  }

  Future<void> lifetimeBanUser(String userId, String reason) async {
    await _api.post('admin/users/$userId/lifetime-ban', {'reason': reason});
  }

  Future<void> deleteUserAccount(String userId) async {
    await _api.delete('admin/users/$userId');
  }

  Future<List<Map<String, dynamic>>> getStreamerApplications() async {
    final res = await _api.get('admin/streamer-applications');
    if (res is! Map<String, dynamic>) return const [];
    return _asMapList((res['applications'] as List?) ?? const []);
  }

  Future<void> setStreamerApproval(String userId, String action) async {
    await _api.patch('admin/streamer-applications/$userId', {'action': action});
  }

  List<Map<String, dynamic>> _asMapList(List raw) {
    return raw
        .whereType<Map>()
        .map((e) => e.map((k, v) => MapEntry(k.toString(), v)))
        .toList(growable: false);
  }
}

extension AdminQueueParsing on Map<String, dynamic> {
  List<AdminQueueItem> parseUpcomingQueue() {
    final upcoming = (this['upcoming'] as List?) ?? const [];
    return upcoming
        .whereType<Map>()
        .map((item) => AdminQueueItem.fromJson(item.cast<String, dynamic>()))
        .toList();
  }

  List<String> parseStackIds() {
    final rows = parseUpcomingQueue();
    return rows
        .map((e) => e.stackId)
        .where((id) => id.trim().isNotEmpty)
        .toList(growable: false);
  }
}

String prettyJson(Object? value) {
  if (value == null) return '';
  return const JsonEncoder.withIndent('  ').convert(value);
}
