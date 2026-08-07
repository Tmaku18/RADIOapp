import 'api_service.dart';

class ArtistAlbum {
  ArtistAlbum({
    required this.id,
    required this.title,
    required this.releaseType,
    this.artworkUrl,
    this.releaseDate,
    required this.trackCount,
  });

  final String id;
  final String title;
  final String releaseType;
  final String? artworkUrl;
  final String? releaseDate;
  final int trackCount;

  factory ArtistAlbum.fromJson(Map<String, dynamic> json) {
    return ArtistAlbum(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      releaseType: json['releaseType']?.toString() ?? 'album',
      artworkUrl: json['artworkUrl']?.toString(),
      releaseDate: json['releaseDate']?.toString(),
      trackCount: () {
        final v = json['trackCount'] ?? json['track_count'];
        if (v is int) return v;
        if (v is num) return v.toInt();
        return int.tryParse(v?.toString() ?? '') ?? 0;
      }(),
    );
  }
}

class AlbumsService {
  final ApiService _api = ApiService();

  Future<List<ArtistAlbum>> listMine() async {
    final res = await _api.get('albums/mine');
    final list = res is Map ? res['albums'] : null;
    if (list is! List) return const [];
    return list
        .whereType<Map>()
        .map((e) => ArtistAlbum.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<ArtistAlbum> create({
    required String title,
    String releaseType = 'album',
  }) async {
    final res = await _api.post('albums', {
      'title': title,
      'releaseType': releaseType,
    });
    return ArtistAlbum.fromJson(Map<String, dynamic>.from(res as Map));
  }

  Future<void> setTracks(String albumId, List<String> songIds) async {
    await _api.put('albums/$albumId/tracks', {'songIds': songIds});
  }

  Future<void> remove(String albumId) async {
    await _api.delete('albums/$albumId');
  }
}
