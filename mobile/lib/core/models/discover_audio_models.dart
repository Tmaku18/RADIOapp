class DiscoverAudioSongCard {
  final String songId;
  final String artistId;
  final String artistName;
  final String? artistDisplayName;
  final String? artistAvatarUrl;
  final String? artistHeadline;
  final String title;
  final String clipUrl;
  final String? backgroundUrl;
  final double clipDurationSeconds;
  final int likeCount;
  final bool likedByMe;

  const DiscoverAudioSongCard({
    required this.songId,
    required this.artistId,
    required this.artistName,
    required this.artistDisplayName,
    required this.artistAvatarUrl,
    required this.artistHeadline,
    required this.title,
    required this.clipUrl,
    required this.backgroundUrl,
    required this.clipDurationSeconds,
    required this.likeCount,
    required this.likedByMe,
  });

  factory DiscoverAudioSongCard.fromJson(Map<String, dynamic> json) {
    double parseDouble(dynamic value, {double fallback = 15}) {
      if (value is num) return value.toDouble();
      return double.tryParse(value?.toString() ?? '') ?? fallback;
    }

    int parseInt(dynamic value, {int fallback = 0}) {
      if (value is int) return value;
      return int.tryParse(value?.toString() ?? '') ?? fallback;
    }

    return DiscoverAudioSongCard(
      songId: (json['songId'] ?? '').toString(),
      artistId: (json['artistId'] ?? '').toString(),
      artistName: (json['artistName'] ?? '').toString(),
      artistDisplayName: json['artistDisplayName']?.toString(),
      artistAvatarUrl: json['artistAvatarUrl']?.toString(),
      artistHeadline: json['artistHeadline']?.toString(),
      title: (json['title'] ?? '').toString(),
      clipUrl: (json['clipUrl'] ?? '').toString(),
      backgroundUrl: json['backgroundUrl']?.toString(),
      clipDurationSeconds: parseDouble(json['clipDurationSeconds']),
      likeCount: parseInt(json['likeCount']),
      likedByMe: json['likedByMe'] == true,
    );
  }
}

class DiscoverAudioFeedPage {
  final List<DiscoverAudioSongCard> items;
  final String? nextCursor;

  const DiscoverAudioFeedPage({required this.items, required this.nextCursor});

  factory DiscoverAudioFeedPage.fromJson(Map<String, dynamic> json) {
    final raw = (json['items'] as List?) ?? const [];
    return DiscoverAudioFeedPage(
      items: raw
          .whereType<Map>()
          .map(
            (e) => DiscoverAudioSongCard.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v)),
            ),
          )
          .toList(),
      nextCursor: json['nextCursor']?.toString(),
    );
  }
}

class DiscoverAudioLikedItem extends DiscoverAudioSongCard {
  final DateTime? likedAt;

  const DiscoverAudioLikedItem({
    required super.songId,
    required super.artistId,
    required super.artistName,
    required super.artistDisplayName,
    required super.artistAvatarUrl,
    required super.artistHeadline,
    required super.title,
    required super.clipUrl,
    required super.backgroundUrl,
    required super.clipDurationSeconds,
    required super.likeCount,
    required super.likedByMe,
    required this.likedAt,
  });

  factory DiscoverAudioLikedItem.fromJson(Map<String, dynamic> json) {
    final base = DiscoverAudioSongCard.fromJson(json);
    return DiscoverAudioLikedItem(
      songId: base.songId,
      artistId: base.artistId,
      artistName: base.artistName,
      artistDisplayName: base.artistDisplayName,
      artistAvatarUrl: base.artistAvatarUrl,
      artistHeadline: base.artistHeadline,
      title: base.title,
      clipUrl: base.clipUrl,
      backgroundUrl: base.backgroundUrl,
      clipDurationSeconds: base.clipDurationSeconds,
      likeCount: base.likeCount,
      likedByMe: base.likedByMe,
      likedAt: json['likedAt'] != null
          ? DateTime.tryParse(json['likedAt'].toString())
          : null,
    );
  }
}
