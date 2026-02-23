import 'api_service.dart';

class RefinerySong {
  final String id;
  final String title;
  final String artistName;
  final String? artworkUrl;
  final String audioUrl;
  final int? durationSeconds;
  final String createdAt;

  RefinerySong({
    required this.id,
    required this.title,
    required this.artistName,
    this.artworkUrl,
    required this.audioUrl,
    this.durationSeconds,
    required this.createdAt,
  });

  factory RefinerySong.fromJson(Map<String, dynamic> json) {
    return RefinerySong(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      artistName: json['artist_name'] as String? ?? '',
      artworkUrl: json['artwork_url'] as String?,
      audioUrl: json['audio_url'] as String? ?? '',
      durationSeconds: json['duration_seconds'] as int?,
      createdAt: json['created_at'] as String? ?? '',
    );
  }
}

class RefineryComment {
  final String id;
  final String body;
  final String createdAt;
  final String? displayName;

  RefineryComment({
    required this.id,
    required this.body,
    required this.createdAt,
    this.displayName,
  });

  factory RefineryComment.fromJson(Map<String, dynamic> json) {
    final users = json['users'];
    return RefineryComment(
      id: json['id'] as String? ?? '',
      body: json['body'] as String? ?? '',
      createdAt: json['created_at'] as String? ?? '',
      displayName: users is Map ? (users['display_name'] as String?) : null,
    );
  }
}

class RefineryService {
  final ApiService _api = ApiService();

  Future<List<RefinerySong>> listSongs({int limit = 100, int offset = 0}) async {
    final res = await _api.get('refinery/songs?limit=$limit&offset=$offset');
    if (res is! Map<String, dynamic>) return [];
    final songs = res['songs'];
    if (songs is! List) return [];
    return songs.map((e) => RefinerySong.fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<List<RefineryComment>> getComments(String songId, {int limit = 50, int offset = 0}) async {
    final res = await _api.get('refinery/songs/$songId/comments?limit=$limit&offset=$offset');
    if (res is! Map<String, dynamic>) return [];
    final comments = res['comments'];
    if (comments is! List) return [];
    return comments.map((e) => RefineryComment.fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<void> addComment(String songId, String body) async {
    await _api.post('refinery/songs/$songId/comments', {'body': body});
  }
}
