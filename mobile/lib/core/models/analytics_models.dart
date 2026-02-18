class DailyPlayCount {
  final String date;
  final int plays;
  DailyPlayCount({required this.date, required this.plays});

  factory DailyPlayCount.fromJson(Map<String, dynamic> json) {
    final p = json['plays'] ?? 0;
    return DailyPlayCount(
      date: (json['date'] ?? '').toString(),
      plays: p is int ? p : int.tryParse(p.toString()) ?? 0,
    );
  }
}

class TopSong {
  final String songId;
  final String title;
  final String? artworkUrl;
  final int totalPlays;
  final int creditsUsed;
  final int creditsRemaining;
  final int likeCount;

  TopSong({
    required this.songId,
    required this.title,
    required this.artworkUrl,
    required this.totalPlays,
    required this.creditsUsed,
    required this.creditsRemaining,
    required this.likeCount,
  });

  factory TopSong.fromJson(Map<String, dynamic> json) {
    int toInt(dynamic v) => v is int ? v : int.tryParse(v.toString()) ?? 0;
    return TopSong(
      songId: (json['songId'] ?? json['song_id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      artworkUrl: (json['artworkUrl'] ?? json['artwork_url'])?.toString(),
      totalPlays: toInt(json['totalPlays'] ?? json['total_plays']),
      creditsUsed: toInt(json['creditsUsed'] ?? json['credits_used']),
      creditsRemaining:
          toInt(json['creditsRemaining'] ?? json['credits_remaining']),
      likeCount: toInt(json['likeCount'] ?? json['like_count']),
    );
  }
}

class ArtistAnalytics {
  final int totalPlays;
  final int totalSongs;
  final int totalLikes;
  final int totalCreditsUsed;
  final int creditsRemaining;
  final List<DailyPlayCount> dailyPlays;
  final List<TopSong> topSongs;

  ArtistAnalytics({
    required this.totalPlays,
    required this.totalSongs,
    required this.totalLikes,
    required this.totalCreditsUsed,
    required this.creditsRemaining,
    required this.dailyPlays,
    required this.topSongs,
  });

  factory ArtistAnalytics.fromJson(Map<String, dynamic> json) {
    int toInt(dynamic v) => v is int ? v : int.tryParse(v.toString()) ?? 0;
    final dp = (json['dailyPlays'] ?? json['daily_plays']) as List? ?? const [];
    final ts = (json['topSongs'] ?? json['top_songs']) as List? ?? const [];
    return ArtistAnalytics(
      totalPlays: toInt(json['totalPlays'] ?? json['total_plays']),
      totalSongs: toInt(json['totalSongs'] ?? json['total_songs']),
      totalLikes: toInt(json['totalLikes'] ?? json['total_likes']),
      totalCreditsUsed:
          toInt(json['totalCreditsUsed'] ?? json['total_credits_used']),
      creditsRemaining:
          toInt(json['creditsRemaining'] ?? json['credits_remaining']),
      dailyPlays: dp
          .whereType<Map>()
          .map((e) => DailyPlayCount.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v))))
          .toList(),
      topSongs: ts
          .whereType<Map>()
          .map((e) =>
              TopSong.fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
          .toList(),
    );
  }
}

