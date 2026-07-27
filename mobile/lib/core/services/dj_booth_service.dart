import 'api_service.dart';

/// Admin DJ Booth API — mirrors web `djBoothApi` (`/admin/dj-booth/*`).
/// Controls global radio transport, mic overlay, duck level, queue, and
/// soundboard for a station.
class DjBoothService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> getStatus(String stationId) async {
    final res = await _api.get('admin/dj-booth/$stationId');
    if (res is Map<String, dynamic>) return res;
    return {};
  }

  Future<Map<String, dynamic>> getQueue(String stationId, {int limit = 25}) async {
    final res = await _api.get('admin/dj-booth/$stationId/queue?limit=$limit');
    if (res is Map<String, dynamic>) return res;
    return {};
  }

  Future<void> replaceQueue(String stationId, List<String> stackIds) async {
    await _api.patch('admin/dj-booth/$stationId/queue', {'stackIds': stackIds});
  }

  Future<void> addQueueEntries(
    String stationId, {
    required List<Map<String, dynamic>> items,
    int? position,
    bool allowDuplicates = false,
  }) async {
    await _api.post('admin/dj-booth/$stationId/queue', {
      'items': items,
      if (position != null) 'position': position,
      'allowDuplicates': allowDuplicates,
    });
  }

  Future<void> removeQueueEntry(
    String stationId, {
    int? position,
    String? stackId,
    String? songId,
  }) async {
    final query = <String>[
      if (position != null) 'position=$position',
      if (stackId != null && stackId.isNotEmpty) 'stackId=$stackId',
      if (songId != null && songId.isNotEmpty) 'songId=$songId',
    ];
    if (query.isEmpty) return;
    await _api.delete('admin/dj-booth/$stationId/queue?${query.join('&')}');
  }

  Future<void> skipForward(String stationId) async {
    await _api.post('admin/dj-booth/$stationId/queue/skip', {});
  }

  Future<void> skipBack(String stationId) async {
    await _api.post('admin/dj-booth/$stationId/transport/back', {});
  }

  Future<Map<String, dynamic>> pauseTransport(String stationId) async {
    final res = await _api.post('admin/dj-booth/$stationId/transport/pause', {});
    if (res is Map<String, dynamic>) return res;
    return {'paused': true};
  }

  Future<Map<String, dynamic>> playTransport(String stationId) async {
    final res = await _api.post('admin/dj-booth/$stationId/transport/play', {});
    if (res is Map<String, dynamic>) return res;
    return {'paused': false};
  }

  Future<Map<String, dynamic>> createMicSession(String stationId) async {
    final res = await _api.post('admin/dj-booth/$stationId/mic/session', {});
    if (res is Map<String, dynamic>) return res;
    return {};
  }

  Future<void> deleteMicSession(String stationId) async {
    await _api.delete('admin/dj-booth/$stationId/mic/session');
  }

  Future<Map<String, dynamic>> micOn(String stationId) async {
    final res = await _api.post('admin/dj-booth/$stationId/mic/on', {});
    if (res is Map<String, dynamic>) return res;
    return {'micActive': true};
  }

  Future<Map<String, dynamic>> micOff(String stationId) async {
    final res = await _api.post('admin/dj-booth/$stationId/mic/off', {});
    if (res is Map<String, dynamic>) return res;
    return {'micActive': false};
  }

  Future<Map<String, dynamic>> setDuckVolume(
    String stationId,
    double duckVolume,
  ) async {
    final res = await _api.patch(
      'admin/dj-booth/$stationId/mic/duck-volume',
      {'duckVolume': duckVolume},
    );
    if (res is Map<String, dynamic>) return res;
    return {'duckVolume': duckVolume};
  }

  Future<List<Map<String, dynamic>>> listSoundboardClips() async {
    final res = await _api.get('admin/dj-booth/soundboard/clips');
    if (res is List) {
      return res.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    }
    if (res is Map<String, dynamic>) {
      final clips = res['clips'];
      if (clips is List) {
        return clips
            .whereType<Map>()
            .map((e) => e.cast<String, dynamic>())
            .toList();
      }
    }
    return const [];
  }

  Future<void> playSoundboardClip(String stationId, String clipId) async {
    await _api.post('admin/dj-booth/$stationId/soundboard/$clipId/play', {});
  }
}
