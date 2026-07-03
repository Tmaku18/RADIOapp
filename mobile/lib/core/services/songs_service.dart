import '../models/song.dart';
import 'api_service.dart';

class TrendingSong {
  final String id;
  final String title;
  final String? artistId;
  final String artistName;
  final String? artworkUrl;
  final String? clipUrl;
  final int clipDurationSeconds;
  final int? durationSeconds;
  final int likeCount;
  final int playCount;
  final int listens;
  final int earsReached;
  final int temperaturePercent;

  const TrendingSong({
    required this.id,
    required this.title,
    required this.artistId,
    required this.artistName,
    required this.artworkUrl,
    required this.clipUrl,
    required this.clipDurationSeconds,
    required this.durationSeconds,
    required this.likeCount,
    required this.playCount,
    required this.listens,
    required this.earsReached,
    required this.temperaturePercent,
  });

  factory TrendingSong.fromJson(Map<String, dynamic> json) {
    int parseInt(dynamic value, {int fallback = 0}) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value?.toString() ?? '') ?? fallback;
    }

    return TrendingSong(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      artistId: (json['artistId'] ?? json['artist_id'])?.toString(),
      artistName: (json['artistName'] ?? json['artist_name'] ?? '').toString(),
      artworkUrl: (json['artworkUrl'] ?? json['artwork_url'])?.toString(),
      clipUrl: (json['clipUrl'] ?? json['clip_url'])?.toString(),
      clipDurationSeconds: parseInt(
        json['clipDurationSeconds'] ?? json['clip_duration_seconds'],
        fallback: 30,
      ),
      durationSeconds: json['durationSeconds'] != null ||
              json['duration_seconds'] != null
          ? parseInt(json['durationSeconds'] ?? json['duration_seconds'])
          : null,
      likeCount: parseInt(json['likeCount'] ?? json['like_count']),
      playCount: parseInt(json['playCount'] ?? json['play_count']),
      listens: parseInt(
        json['listens'] ?? json['earsReached'] ?? json['ears_reached'],
      ),
      earsReached: parseInt(json['earsReached'] ?? json['ears_reached']),
      temperaturePercent: parseInt(
        json['temperaturePercent'] ?? json['temperature_percent'],
        fallback: 50,
      ),
    );
  }
}

class TrendingArtist {
  final String id;
  final String displayName;
  final String? avatarUrl;
  final int songCount;
  final int likeCount;
  final int playCount;
  final int listens;
  final int earsReached;

  const TrendingArtist({
    required this.id,
    required this.displayName,
    required this.avatarUrl,
    required this.songCount,
    required this.likeCount,
    required this.playCount,
    required this.listens,
    required this.earsReached,
  });

  factory TrendingArtist.fromJson(Map<String, dynamic> json) {
    int parseInt(dynamic value, {int fallback = 0}) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value?.toString() ?? '') ?? fallback;
    }

    return TrendingArtist(
      id: (json['id'] ?? '').toString(),
      displayName:
          (json['displayName'] ?? json['display_name'] ?? 'Artist').toString(),
      avatarUrl: (json['avatarUrl'] ?? json['avatar_url'])?.toString(),
      songCount: parseInt(json['songCount'] ?? json['song_count']),
      likeCount: parseInt(json['likeCount'] ?? json['like_count']),
      playCount: parseInt(json['playCount'] ?? json['play_count']),
      listens: parseInt(
        json['listens'] ?? json['earsReached'] ?? json['ears_reached'],
      ),
      earsReached: parseInt(json['earsReached'] ?? json['ears_reached']),
    );
  }
}

class TrendingData {
  final List<TrendingSong> songs;
  final List<TrendingArtist> artists;
  final int averageTemperature;
  final int topTemperature;

  const TrendingData({
    required this.songs,
    required this.artists,
    required this.averageTemperature,
    required this.topTemperature,
  });

  factory TrendingData.fromJson(Map<String, dynamic> json) {
    int parseInt(dynamic value, {int fallback = 0}) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value?.toString() ?? '') ?? fallback;
    }

    final temp = json['temperature'];
    final tempMap = temp is Map
        ? temp.map((k, v) => MapEntry(k.toString(), v))
        : const <String, dynamic>{};

    List<T> parseList<T>(
      dynamic raw,
      T Function(Map<String, dynamic>) fromJson,
    ) {
      if (raw is! List) return const [];
      return raw
          .whereType<Map>()
          .map((e) => fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }

    return TrendingData(
      songs: parseList(json['songs'], TrendingSong.fromJson),
      artists: parseList(json['artists'], TrendingArtist.fromJson),
      averageTemperature: parseInt(tempMap['average'], fallback: 50),
      topTemperature: parseInt(tempMap['top'], fallback: 50),
    );
  }
}

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

  const SongLikesResponse({required this.totalLikes, required this.likes});
}

class LibrarySong {
  final String id;
  final String title;
  final String artistName;
  final String artistId;
  final String? artworkUrl;
  final String? audioUrl;
  final String? sampleUrl;
  final int durationSeconds;
  final int likeCount;
  final int playCount;
  final int priceCents;
  final bool forSale;
  final bool owned;
  final bool discoverEnabled;
  final String? discoverClipUrl;
  final int fireVotes;
  final int shitVotes;
  final int temperaturePercent;
  final DateTime? likedAt;

  const LibrarySong({
    required this.id,
    required this.title,
    required this.artistName,
    required this.artistId,
    required this.artworkUrl,
    required this.audioUrl,
    required this.sampleUrl,
    required this.durationSeconds,
    required this.likeCount,
    required this.playCount,
    required this.priceCents,
    required this.forSale,
    required this.owned,
    required this.discoverEnabled,
    required this.discoverClipUrl,
    required this.fireVotes,
    required this.shitVotes,
    required this.temperaturePercent,
    required this.likedAt,
  });

  factory LibrarySong.fromJson(Map<String, dynamic> json) {
    int parseInt(dynamic value, {int fallback = 0}) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value?.toString() ?? '') ?? fallback;
    }

    return LibrarySong(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      artistName: (json['artistName'] ?? '').toString(),
      artistId: (json['artistId'] ?? '').toString(),
      artworkUrl: json['artworkUrl']?.toString(),
      audioUrl: json['audioUrl']?.toString(),
      sampleUrl: json['sampleUrl']?.toString(),
      durationSeconds: parseInt(json['durationSeconds']),
      likeCount: parseInt(json['likeCount']),
      playCount: parseInt(json['playCount']),
      priceCents: parseInt(json['priceCents'], fallback: 99),
      forSale: json['forSale'] == true,
      owned: json['owned'] == true,
      discoverEnabled: json['discoverEnabled'] == true,
      discoverClipUrl: json['discoverClipUrl']?.toString(),
      fireVotes: parseInt(json['fireVotes']),
      shitVotes: parseInt(json['shitVotes']),
      temperaturePercent: parseInt(json['temperaturePercent']),
      likedAt: json['likedAt'] != null
          ? DateTime.tryParse(json['likedAt'].toString())
          : null,
    );
  }
}

class PurchasedSong {
  final String id;
  final String title;
  final String artistName;
  final String artistId;
  final String? artworkUrl;
  final int durationSeconds;
  final DateTime? purchasedAt;

  /// True when this row is the user's own upload rather than a purchase.
  final bool isOwnUpload;

  const PurchasedSong({
    required this.id,
    required this.title,
    required this.artistName,
    required this.artistId,
    required this.artworkUrl,
    required this.durationSeconds,
    required this.purchasedAt,
    this.isOwnUpload = false,
  });

  factory PurchasedSong.fromJson(Map<String, dynamic> json) {
    int parseInt(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value?.toString() ?? '') ?? 0;
    }

    return PurchasedSong(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      artistName: (json['artistName'] ?? '').toString(),
      artistId: (json['artistId'] ?? '').toString(),
      artworkUrl: json['artworkUrl']?.toString(),
      durationSeconds: parseInt(json['durationSeconds']),
      purchasedAt: json['purchasedAt'] != null
          ? DateTime.tryParse(json['purchasedAt'].toString())
          : null,
      isOwnUpload: json['isOwnUpload'] == true,
    );
  }
}

class SongAccess {
  final bool owned;
  final bool isOwner;
  final int priceCents;
  final bool forSale;
  final String? sampleUrl;

  const SongAccess({
    required this.owned,
    required this.isOwner,
    required this.priceCents,
    required this.forSale,
    required this.sampleUrl,
  });

  factory SongAccess.fromJson(Map<String, dynamic> json) {
    int parseInt(dynamic value, {int fallback = 0}) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value?.toString() ?? '') ?? fallback;
    }

    return SongAccess(
      owned: json['owned'] == true,
      isOwner: json['isOwner'] == true,
      priceCents: parseInt(json['priceCents'], fallback: 99),
      forSale: json['forSale'] != false,
      sampleUrl: json['sampleUrl']?.toString(),
    );
  }
}

class SongLyrics {
  final String? plainText;
  final List<Map<String, dynamic>>? timedLines;

  /// none | pending | ready | failed
  final String status;

  const SongLyrics({
    required this.plainText,
    required this.timedLines,
    required this.status,
  });

  factory SongLyrics.fromJson(Map<String, dynamic> json) {
    final timed = json['timedLines'];
    return SongLyrics(
      plainText: json['plainText']?.toString(),
      timedLines: timed is List
          ? timed.whereType<Map<String, dynamic>>().toList()
          : null,
      status: (json['status'] ?? 'none').toString(),
    );
  }
}

class SongsService {
  final ApiService _api = ApiService();

  Future<List<Song>> getMine() async {
    final res = await _api.get('songs/mine');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => Song.fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    return const [];
  }

  Future<List<Song>> listApprovedByArtist(
    String artistId, {
    int limit = 50,
    int offset = 0,
  }) async {
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

  Future<List<LibrarySong>> getLibrary({
    int limit = 100,
    int offset = 0,
  }) async {
    final safeLimit = limit.clamp(1, 200);
    final safeOffset = offset < 0 ? 0 : offset;
    final res = await _api.get(
      'songs/library?limit=$safeLimit&offset=$safeOffset',
    );
    if (res is List) {
      return res
          .whereType<Map>()
          .map(
            (e) => LibrarySong.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v)),
            ),
          )
          .toList();
    }
    return const <LibrarySong>[];
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

  Future<void> recordProfileListen(
    String songId, {
    String? startedAt,
    int? secondsListened,
  }) async {
    await _api.post('songs/$songId/profile-listen', {
      if (startedAt != null) 'startedAt': startedAt,
      if (secondsListened != null) 'secondsListened': secondsListened,
    });
  }

  Future<List<PurchasedSong>> getPurchases({
    int limit = 100,
    int offset = 0,
  }) async {
    final safeLimit = limit.clamp(1, 200);
    final safeOffset = offset < 0 ? 0 : offset;
    final res = await _api.get(
      'songs/purchases?limit=$safeLimit&offset=$safeOffset',
    );
    if (res is List) {
      return res
          .whereType<Map>()
          .map(
            (e) => PurchasedSong.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v)),
            ),
          )
          .toList();
    }
    return const <PurchasedSong>[];
  }

  Future<SongAccess?> getAccess(String songId) async {
    final res = await _api.get('songs/$songId/access');
    if (res is Map<String, dynamic>) return SongAccess.fromJson(res);
    return null;
  }

  Future<String?> getStreamUrl(String songId) async {
    final res = await _api.get('songs/$songId/stream');
    if (res is Map<String, dynamic>) return res['url']?.toString();
    return null;
  }

  Future<String?> getDownloadUrl(String songId) async {
    final res = await _api.get('songs/$songId/download');
    if (res is Map<String, dynamic>) return res['url']?.toString();
    return null;
  }

  Future<Map<String, dynamic>?> setSample(
    String songId,
    num startSeconds, {
    num? endSeconds,
  }) async {
    final res = await _api.post('songs/$songId/sample', {
      'startSeconds': startSeconds,
      if (endSeconds != null) 'endSeconds': endSeconds,
    });
    if (res is Map<String, dynamic>) return res;
    return null;
  }

  /// Render + publish a discover clip from the song's own audio.
  Future<Map<String, dynamic>?> publishDiscover(
    String songId, {
    required num clipStartSeconds,
    required num clipEndSeconds,
    String? discoverBackgroundUrl,
  }) async {
    final res = await _api.post('songs/$songId/discover/publish', {
      'clipStartSeconds': clipStartSeconds,
      'clipEndSeconds': clipEndSeconds,
      if (discoverBackgroundUrl != null)
        'discoverBackgroundUrl': discoverBackgroundUrl,
    });
    if (res is Map<String, dynamic>) return res;
    return null;
  }

  /// Lyrics + auto-sync status for a song.
  /// `status`: none | pending (syncing) | ready (synced) | failed.
  Future<SongLyrics?> getLyrics(String songId) async {
    final res = await _api.get('songs/$songId/lyrics');
    if (res is Map<String, dynamic>) return SongLyrics.fromJson(res);
    return null;
  }

  /// Save lyrics text (owner/admin). The backend re-aligns captions to the
  /// audio automatically whenever the plain text changes.
  Future<SongLyrics?> upsertLyrics(String songId, String plainText) async {
    final res = await _api.patch('songs/$songId/lyrics', {
      'plainText': plainText,
    });
    if (res is Map<String, dynamic>) return SongLyrics.fromJson(res);
    return null;
  }

  /// Public homepage showcase: trending songs, artists, and temperature.
  /// Mirrors web GET /api/songs/public/trending (no auth required).
  Future<TrendingData?> getPublicTrending({int limit = 12}) async {
    final safeLimit = limit.clamp(1, 24);
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        final res = await _api.get(
          'songs/public/trending?limit=$safeLimit',
        );
        if (res is Map<String, dynamic>) {
          final data = TrendingData.fromJson(res);
          if (data.songs.isNotEmpty || data.artists.isNotEmpty) return data;
        }
      } catch (_) {
        // Retry once — this endpoint can be slow on a cold backend.
      }
    }
    return null;
  }
}
