class LeaderboardSong {
  final String id;
  final String title;
  final String artistName;
  final String artistId;
  final String? artworkUrl;
  final int likeCount;
  final int playCount;
  final int spotlightListenCount;
  final int? windowMinutes;
  final int? likesInWindow;
  final int? playsInWindow;
  final double? upvotesPerMinute;

  LeaderboardSong({
    required this.id,
    required this.title,
    required this.artistName,
    required this.artistId,
    this.artworkUrl,
    required this.likeCount,
    required this.playCount,
    required this.spotlightListenCount,
    this.windowMinutes,
    this.likesInWindow,
    this.playsInWindow,
    this.upvotesPerMinute,
  });

  factory LeaderboardSong.fromJson(Map<String, dynamic> json) {
    double? toDouble(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString());
    }

    int? toNullableInt(dynamic v) {
      if (v == null) return null;
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString());
    }

    return LeaderboardSong(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      artistName: (json['artistName'] ?? json['artist_name'] ?? 'Unknown')
          .toString(),
      artistId: (json['artistId'] ?? json['artist_id'] ?? '').toString(),
      artworkUrl: (json['artworkUrl'] ?? json['artwork_url'])?.toString(),
      likeCount: (json['likeCount'] ?? json['like_count'] ?? 0) is int
          ? (json['likeCount'] ?? json['like_count'] ?? 0) as int
          : int.tryParse((json['likeCount'] ?? json['like_count'] ?? '0').toString()) ??
              0,
      playCount: (json['playCount'] ?? json['play_count'] ?? 0) is int
          ? (json['playCount'] ?? json['play_count'] ?? 0) as int
          : int.tryParse((json['playCount'] ?? json['play_count'] ?? '0').toString()) ??
              0,
      spotlightListenCount:
          (json['spotlightListenCount'] ?? json['spotlight_listen_count'] ?? 0)
                  is int
              ? (json['spotlightListenCount'] ??
                  json['spotlight_listen_count'] ??
                  0) as int
              : int.tryParse(
                    (json['spotlightListenCount'] ??
                            json['spotlight_listen_count'] ??
                            '0')
                        .toString(),
                  ) ??
                  0,
      windowMinutes: toNullableInt(json['windowMinutes'] ?? json['window_minutes']),
      likesInWindow: toNullableInt(json['likesInWindow'] ?? json['likes_in_window']),
      playsInWindow: toNullableInt(json['playsInWindow'] ?? json['plays_in_window']),
      upvotesPerMinute: toDouble(json['upvotesPerMinute'] ?? json['upvotes_per_minute']),
    );
  }
}

class NewsItem {
  final String id;
  final String type;
  final String title;
  final String? bodyOrDescription;
  final String? imageUrl;
  final String? linkUrl;
  final DateTime createdAt;

  NewsItem({
    required this.id,
    required this.type,
    required this.title,
    required this.bodyOrDescription,
    required this.imageUrl,
    required this.linkUrl,
    required this.createdAt,
  });

  factory NewsItem.fromJson(Map<String, dynamic> json) {
    return NewsItem(
      id: (json['id'] ?? '').toString(),
      type: (json['type'] ?? 'news').toString(),
      title: (json['title'] ?? '').toString(),
      bodyOrDescription: (json['bodyOrDescription'] ?? json['body_or_description'])
          ?.toString(),
      imageUrl: (json['imageUrl'] ?? json['image_url'])?.toString(),
      linkUrl: (json['linkUrl'] ?? json['link_url'])?.toString(),
      createdAt: DateTime.tryParse((json['createdAt'] ?? json['created_at'] ?? '').toString()) ??
          DateTime.now(),
    );
  }
}

class SpotlightToday {
  final String artistId;
  final String artistName;
  final String? songId;
  final String? songTitle;

  SpotlightToday({
    required this.artistId,
    required this.artistName,
    required this.songId,
    required this.songTitle,
  });

  factory SpotlightToday.fromJson(Map<String, dynamic> json) {
    return SpotlightToday(
      artistId: (json['artistId'] ?? json['artist_id'] ?? '').toString(),
      artistName: (json['artistName'] ?? json['artist_name'] ?? 'Artist')
          .toString(),
      songId: (json['songId'] ?? json['song_id'])?.toString(),
      songTitle: (json['songTitle'] ?? json['song_title'])?.toString(),
    );
  }
}

class SpotlightWeekDay {
  final String date;
  final String artistId;
  final String artistName;

  SpotlightWeekDay({
    required this.date,
    required this.artistId,
    required this.artistName,
  });

  factory SpotlightWeekDay.fromJson(Map<String, dynamic> json) {
    return SpotlightWeekDay(
      date: (json['date'] ?? '').toString(),
      artistId: (json['artistId'] ?? json['artist_id'] ?? '').toString(),
      artistName: (json['artistName'] ?? json['artist_name'] ?? 'Artist')
          .toString(),
    );
  }
}

class CurrentWeek {
  final String periodStart;
  final String periodEnd;
  final bool votingOpen;

  CurrentWeek({
    required this.periodStart,
    required this.periodEnd,
    required this.votingOpen,
  });

  factory CurrentWeek.fromJson(Map<String, dynamic> json) {
    return CurrentWeek(
      periodStart: (json['periodStart'] ?? json['period_start'] ?? '').toString(),
      periodEnd: (json['periodEnd'] ?? json['period_end'] ?? '').toString(),
      votingOpen: json['votingOpen'] == true || json['voting_open'] == true,
    );
  }
}

class BrowseLeaderboardItem {
  final String id;
  final String? title;
  final String fileUrl;
  final int likeCount;
  final String? providerDisplayName;

  BrowseLeaderboardItem({
    required this.id,
    required this.title,
    required this.fileUrl,
    required this.likeCount,
    required this.providerDisplayName,
  });

  factory BrowseLeaderboardItem.fromJson(Map<String, dynamic> json) {
    final provider = json['provider'];
    return BrowseLeaderboardItem(
      id: (json['id'] ?? '').toString(),
      title: json['title']?.toString(),
      fileUrl: (json['fileUrl'] ?? json['file_url'] ?? '').toString(),
      likeCount: (json['likeCount'] ?? json['like_count'] ?? 0) is int
          ? (json['likeCount'] ?? json['like_count'] ?? 0) as int
          : int.tryParse((json['likeCount'] ?? json['like_count'] ?? '0').toString()) ??
              0,
      providerDisplayName: provider is Map<String, dynamic>
          ? (provider['displayName'] ?? provider['display_name'])?.toString()
          : null,
    );
  }
}

class BrowseLeaderboardCategory {
  final String serviceType;
  final List<BrowseLeaderboardItem> items;

  BrowseLeaderboardCategory({required this.serviceType, required this.items});

  factory BrowseLeaderboardCategory.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] as List?) ?? const [];
    return BrowseLeaderboardCategory(
      serviceType: (json['serviceType'] ?? json['service_type'] ?? '').toString(),
      items: rawItems
          .whereType<Map>()
          .map((e) => BrowseLeaderboardItem.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v))))
          .toList(),
    );
  }
}

