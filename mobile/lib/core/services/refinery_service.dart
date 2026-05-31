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

double? _toDoubleOrNull(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

int _toInt(dynamic v, [int fallback = 0]) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v?.toString() ?? '') ?? fallback;
}

class RefineryRatingStats {
  final int count;
  final double? mean;
  final double? median;
  final double? stddev;

  RefineryRatingStats({
    required this.count,
    this.mean,
    this.median,
    this.stddev,
  });

  factory RefineryRatingStats.fromJson(Map<String, dynamic> json) {
    return RefineryRatingStats(
      count: _toInt(json['count']),
      mean: _toDoubleOrNull(json['mean']),
      median: _toDoubleOrNull(json['median']),
      stddev: _toDoubleOrNull(json['stddev']),
    );
  }
}

class RefineryCustomQuestionSummary {
  final String id;
  final String questionText;
  final int totalResponses;
  final List<String> recentResponses;

  RefineryCustomQuestionSummary({
    required this.id,
    required this.questionText,
    required this.totalResponses,
    required this.recentResponses,
  });

  factory RefineryCustomQuestionSummary.fromJson(Map<String, dynamic> json) {
    final raw = json['recentResponses'];
    return RefineryCustomQuestionSummary(
      id: json['id']?.toString() ?? '',
      questionText: json['questionText']?.toString() ?? '',
      totalResponses: _toInt(json['totalResponses']),
      recentResponses: raw is List
          ? raw.map((e) => e.toString()).toList()
          : const [],
    );
  }
}

class RefineryReviewItem {
  final String id;
  final String createdAt;
  final int overallRating;
  final int beatRating;
  final int lyricsRating;
  final int lyricsBeatMatchRating;
  final int pacingRating;
  final int chorusRating;
  final int openingEndingRating;
  final String? comment;
  final bool isOutlier;

  RefineryReviewItem({
    required this.id,
    required this.createdAt,
    required this.overallRating,
    required this.beatRating,
    required this.lyricsRating,
    required this.lyricsBeatMatchRating,
    required this.pacingRating,
    required this.chorusRating,
    required this.openingEndingRating,
    required this.comment,
    required this.isOutlier,
  });

  factory RefineryReviewItem.fromJson(Map<String, dynamic> json) {
    final c = json['comment']?.toString();
    return RefineryReviewItem(
      id: json['id']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      overallRating: _toInt(json['overallRating']),
      beatRating: _toInt(json['beatRating']),
      lyricsRating: _toInt(json['lyricsRating']),
      lyricsBeatMatchRating: _toInt(json['lyricsBeatMatchRating']),
      pacingRating: _toInt(json['pacingRating']),
      chorusRating: _toInt(json['chorusRating']),
      openingEndingRating: _toInt(json['openingEndingRating']),
      comment: (c == null || c.isEmpty) ? null : c,
      isOutlier: json['isOutlier'] == true,
    );
  }
}

class RefineryAnalytics {
  final String songTitle;
  final String artistName;
  final String? artworkUrl;
  final bool inRefinery;
  final int reviewCount;
  final int minReviews;
  final int totalReviews;
  final int outlierCount;
  final Map<String, RefineryRatingStats> ratingStats;
  final Map<String, Map<String, int>> surveyDistributions;
  final List<RefineryCustomQuestionSummary> customQuestions;
  final List<RefineryReviewItem> reviews;

  RefineryAnalytics({
    required this.songTitle,
    required this.artistName,
    required this.artworkUrl,
    required this.inRefinery,
    required this.reviewCount,
    required this.minReviews,
    required this.totalReviews,
    required this.outlierCount,
    required this.ratingStats,
    required this.surveyDistributions,
    required this.customQuestions,
    required this.reviews,
  });

  factory RefineryAnalytics.fromJson(Map<String, dynamic> json) {
    final song = (json['song'] is Map)
        ? Map<String, dynamic>.from(json['song'] as Map)
        : <String, dynamic>{};
    final summary = (json['summary'] is Map)
        ? Map<String, dynamic>.from(json['summary'] as Map)
        : <String, dynamic>{};

    final ratingStats = <String, RefineryRatingStats>{};
    if (summary['ratingStats'] is Map) {
      (summary['ratingStats'] as Map).forEach((k, v) {
        if (v is Map) {
          ratingStats[k.toString()] = RefineryRatingStats.fromJson(
            Map<String, dynamic>.from(v),
          );
        }
      });
    }

    final surveyDistributions = <String, Map<String, int>>{};
    if (summary['surveyDistributions'] is Map) {
      (summary['surveyDistributions'] as Map).forEach((k, v) {
        if (v is Map) {
          final inner = <String, int>{};
          v.forEach((ik, iv) => inner[ik.toString()] = _toInt(iv));
          surveyDistributions[k.toString()] = inner;
        }
      });
    }

    final customQuestions = <RefineryCustomQuestionSummary>[];
    if (summary['customQuestions'] is List) {
      for (final e in (summary['customQuestions'] as List)) {
        if (e is Map) {
          customQuestions.add(RefineryCustomQuestionSummary.fromJson(
            Map<String, dynamic>.from(e),
          ));
        }
      }
    }

    final reviews = <RefineryReviewItem>[];
    if (json['reviews'] is List) {
      for (final e in (json['reviews'] as List)) {
        if (e is Map) {
          reviews.add(RefineryReviewItem.fromJson(
            Map<String, dynamic>.from(e),
          ));
        }
      }
    }

    return RefineryAnalytics(
      songTitle: song['title']?.toString() ?? '',
      artistName: song['artistName']?.toString() ?? '',
      artworkUrl: song['artworkUrl']?.toString(),
      inRefinery: song['inRefinery'] == true,
      reviewCount: _toInt(song['reviewCount']),
      minReviews: _toInt(song['minReviews'], 1),
      totalReviews: _toInt(summary['totalReviews']),
      outlierCount: _toInt(summary['outlierCount']),
      ratingStats: ratingStats,
      surveyDistributions: surveyDistributions,
      customQuestions: customQuestions,
      reviews: reviews,
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

  /// Artist adds their own approved song to The Refinery.
  Future<void> addSongToRefinery(String songId) async {
    await _api.post('refinery/songs/$songId/add', {});
  }

  /// Artist removes their song from The Refinery.
  Future<void> removeSongFromRefinery(String songId) async {
    await _api.post('refinery/songs/$songId/remove', {});
  }

  /// Artist-facing aggregated review analytics for one of their songs.
  Future<RefineryAnalytics> getAnalytics(
    String songId, {
    int limit = 100,
    int offset = 0,
  }) async {
    final res =
        await _api.get('refinery/songs/$songId/analytics?limit=$limit&offset=$offset');
    if (res is Map<String, dynamic>) return RefineryAnalytics.fromJson(res);
    throw Exception('Failed to load refinery analytics');
  }
}
