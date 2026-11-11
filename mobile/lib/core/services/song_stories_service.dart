import 'dart:io';

import 'api_service.dart';

class SongStory {
  const SongStory({
    required this.id,
    required this.songId,
    required this.mediaUrl,
    required this.caption,
    required this.visibility,
    required this.mine,
    required this.authorName,
    required this.avatarUrl,
  });

  final String id;
  final String songId;
  final String mediaUrl;
  final String? caption;
  final String visibility;
  final bool mine;
  final String authorName;
  final String? avatarUrl;

  bool get isPublic => visibility != 'private';

  factory SongStory.fromJson(Map<String, dynamic> json) {
    final author = json['author'];
    final authorMap = author is Map
        ? author.map((key, value) => MapEntry(key.toString(), value))
        : const <String, dynamic>{};
    return SongStory(
      id: '${json['id'] ?? ''}',
      songId: '${json['songId'] ?? ''}',
      mediaUrl: '${json['mediaUrl'] ?? ''}',
      caption: json['caption']?.toString(),
      visibility: '${json['visibility'] ?? 'public'}',
      mine: json['mine'] == true,
      authorName: '${authorMap['displayName'] ?? 'Listener'}',
      avatarUrl: authorMap['avatarUrl']?.toString(),
    );
  }
}

class SongStoriesService {
  final ApiService _api = ApiService();

  static bool isSongId(String? value) {
    if (value == null) return false;
    return RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    ).hasMatch(value.trim());
  }

  Future<List<SongStory>> list(String songId) async {
    if (!isSongId(songId)) return const [];
    final res = await _api.get(
      'song-stories?songId=${Uri.encodeQueryComponent(songId)}',
    );
    if (res is! Map) return const [];
    final raw = res['stories'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map(
          (row) => SongStory.fromJson(
            row.map((key, value) => MapEntry(key.toString(), value)),
          ),
        )
        .where((story) => story.mediaUrl.isNotEmpty)
        .toList();
  }

  Future<void> postClip({
    required File file,
    required String songId,
    required bool isPublic,
    String? caption,
  }) async {
    final lower = file.path.toLowerCase();
    final mime = lower.endsWith('.webm')
        ? 'video/webm'
        : lower.endsWith('.mov')
            ? 'video/quicktime'
            : 'video/mp4';
    final name = mime == 'video/webm'
        ? 'story.webm'
        : mime == 'video/quicktime'
            ? 'story.mov'
            : 'story.mp4';
    final ticket = await _api.post('discovery/feed/upload-url', {
      'contentType': mime,
      'filename': name,
    });
    final signedUrl = ticket is Map ? '${ticket['signedUrl'] ?? ''}'.trim() : '';
    final path = ticket is Map ? '${ticket['path'] ?? ''}'.trim() : '';
    if (signedUrl.isEmpty || path.isEmpty) {
      throw Exception('Could not start the upload');
    }
    await _api.putFileToSignedUrl(signedUrl, file, contentType: mime);
    await _api.post('song-stories', {
      'path': path,
      'songId': songId,
      'visibility': isPublic ? 'public' : 'private',
      if (caption != null && caption.trim().isNotEmpty) 'caption': caption.trim(),
      'contentType': mime,
    });
  }

  Future<void> setVisibility(String storyId, bool isPublic) async {
    await _api.patch('song-stories/$storyId', {
      'visibility': isPublic ? 'public' : 'private',
    });
  }

  Future<void> remove(String storyId) async {
    await _api.delete('song-stories/$storyId');
  }
}
