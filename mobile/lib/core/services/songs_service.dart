import '../models/song.dart';
import 'api_service.dart';

class SongLikeUser {
  final String userId;
  final String? displayName;
  final String? avatarUrl;
  final DateTime? likedAt;

  const SongLikeUser({
    required this.userId,
    this.displayName,
    this.avatarUrl,
    this.likedAt,
  });

  factory SongLikeUser.fromJson(Map<String, dynamic> json) {
    return SongLikeUser(
      userId: (json['userId'] ?? '').toString(),
      displayName: json['displayName']?.toString(),
      avatarUrl: json['avatarUrl']?.toString(),
      likedAt: json['likedAt'] != null
          ? DateTime.tryParse(json['likedAt'].toString())
          : null,
    );
  }
}

class SongLikesResponse {
  final int totalLikes;
  final List<SongLikeUser> likes;

  const SongLikesResponse({
    required this.totalLikes,
    required this.likes,
  });
}

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

  Future<SongLikesResponse> getLikes(
    String songId, {
    int limit = 200,
    int offset = 0,
  }) async {
    final safeLimit = limit.clamp(1, 200);
    final safeOffset = offset < 0 ? 0 : offset;
    final res = await _api.get(
      'songs/$songId/likes?limit=$safeLimit&offset=$safeOffset',
    );
    if (res is! Map<String, dynamic>) {
      return const SongLikesResponse(totalLikes: 0, likes: <SongLikeUser>[]);
    }
    final totalLikes = (res['totalLikes'] as num?)?.toInt() ?? 0;
    final rawLikes = (res['likes'] as List?) ?? const [];
    final likes = rawLikes
        .whereType<Map>()
        .map(
          (e) =>
              SongLikeUser.fromJson(e.map((k, v) => MapEntry(k.toString(), v))),
        )
        .toList();
    return SongLikesResponse(totalLikes: totalLikes, likes: likes);
  }

  Future<void> recordProfileListen(String songId, {String? startedAt, int? secondsListened}) async {
    await _api.post('songs/$songId/profile-listen', {
      if (startedAt != null) 'startedAt': startedAt,
      if (secondsListened != null) 'secondsListened': secondsListened,
    });
  }
}

