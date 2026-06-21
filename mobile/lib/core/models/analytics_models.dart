class DailyPlayCount {
  final String date;
  final int plays;
  final int listens;
  final int ears;

  DailyPlayCount({
    required this.date,
    required this.plays,
    required this.listens,
    required this.ears,
  });

  factory DailyPlayCount.fromJson(Map<String, dynamic> json) {
    int toInt(dynamic v) => v is int ? v : int.tryParse(v.toString()) ?? 0;
    final plays = toInt(json['plays']);
    return DailyPlayCount(
      date: (json['date'] ?? '').toString(),
      plays: plays,
      listens: toInt(json['listens'] ?? 0),
      ears: toInt(json['ears'] ?? json['listens'] ?? 0),
    );
  }
}

class TopSong {
  final String songId;
  final String title;
  final String? artworkUrl;
  final int totalPlays;
  final int totalListens;
  final int paidPlays;
  final int freePlays;
  final int creditsUsed;
  final int creditsRemaining;
  final int likeCount;

  TopSong({
    required this.songId,
    required this.title,
    required this.artworkUrl,
    required this.totalPlays,
    required this.totalListens,
    required this.paidPlays,
    required this.freePlays,
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
      totalListens: toInt(json['totalListens'] ?? json['total_listens']),
      paidPlays: toInt(json['paidPlays'] ?? json['paid_plays']),
      freePlays: toInt(json['freePlays'] ?? json['free_plays']),
      creditsUsed: toInt(json['creditsUsed'] ?? json['credits_used']),
      creditsRemaining:
          toInt(json['creditsRemaining'] ?? json['credits_remaining']),
      likeCount: toInt(json['likeCount'] ?? json['like_count']),
    );
  }
}

class ArtistAnalytics {
  final int totalPlays;
  final int totalListenCount;
  final int earsReached;
  final int listensThisWeek;
  final int listensThisMonth;
  final int earsReachedThisWeek;
  final int earsReachedThisMonth;
  final int totalPaidPlays;
  final int totalFreePlays;
  final int totalSongs;
  final int totalLikes;
  final int totalCreditsUsed;
  final int creditsRemaining;
  final List<DailyPlayCount> dailyPlays;
  final List<TopSong> topSongs;

  ArtistAnalytics({
    required this.totalPlays,
    required this.totalListenCount,
    required this.earsReached,
    required this.listensThisWeek,
    required this.listensThisMonth,
    required this.earsReachedThisWeek,
    required this.earsReachedThisMonth,
    required this.totalPaidPlays,
    required this.totalFreePlays,
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
      totalListenCount:
          toInt(json['totalListenCount'] ?? json['total_listen_count']),
      earsReached: toInt(json['earsReached'] ?? json['ears_reached']),
      listensThisWeek:
          toInt(json['listensThisWeek'] ?? json['listens_this_week']),
      listensThisMonth:
          toInt(json['listensThisMonth'] ?? json['listens_this_month']),
      earsReachedThisWeek:
          toInt(json['earsReachedThisWeek'] ?? json['ears_reached_this_week']),
      earsReachedThisMonth:
          toInt(json['earsReachedThisMonth'] ?? json['ears_reached_this_month']),
      totalPaidPlays:
          toInt(json['totalPaidPlays'] ?? json['total_paid_plays']),
      totalFreePlays:
          toInt(json['totalFreePlays'] ?? json['total_free_plays']),
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
