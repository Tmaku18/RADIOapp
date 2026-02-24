import '../models/song.dart';
import 'api_service.dart';

class SongsService {
  final ApiService _api = ApiService();

  Future<List<Song>> getMine() async {
    final res = await _api.get('songs/mine');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) =>
              Song.fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    return const [];
  }

  Future<List<Song>> listApprovedByArtist(String artistId, {int limit = 50, int offset = 0}) async {
    final res = await _api.get(
      'songs?artistId=${Uri.encodeComponent(artistId)}&status=approved&limit=$limit&offset=$offset',
    );
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => Song.fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    return const [];
  }

  Future<bool> getLikeStatus(String songId) async {
    final res = await _api.get('songs/$songId/like');
    if (res is Map<String, dynamic>) return res['liked'] == true;
    return false;
  }

  Future<bool> like(String songId) async {
    final res = await _api.post('songs/$songId/like', {});
    if (res is Map<String, dynamic>) return res['liked'] == true;
    return true;
  }

  Future<bool> unlike(String songId) async {
    final res = await _api.delete('songs/$songId/like');
    if (res is Map<String, dynamic>) return res['liked'] == true;
    return false;
  }

  Future<void> recordProfileListen(String songId, {String? startedAt, int? secondsListened}) async {
    await _api.post('songs/$songId/profile-listen', {
      if (startedAt != null) 'startedAt': startedAt,
      if (secondsListened != null) 'secondsListened': secondsListened,
    });
  }
}

