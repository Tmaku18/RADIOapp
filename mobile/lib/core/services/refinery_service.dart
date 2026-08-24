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
      id: (json['songId'] ?? json['id'])?.toString() ?? '',
      title: json['title'] as String? ?? '',
      artistName:
          (json['artistName'] ?? json['artist_name'])?.toString() ?? '',
      artworkUrl:
          (json['artworkUrl'] ?? json['artwork_url'])?.toString(),
      audioUrl: (json['audioUrl'] ?? json['audio_url'])?.toString() ?? '',
      durationSeconds: json['durationSeconds'] as int? ??
          json['duration_seconds'] as int?,
      createdAt:
          (json['submittedAt'] ?? json['created_at'])?.toString() ?? '',
    );
  }
}

class RefineryCustomQuestion {
  final String id;
  final String questionText;

  const RefineryCustomQuestion({
    required this.id,
    required this.questionText,
  });

  factory RefineryCustomQuestion.fromJson(Map<String, dynamic> json) {
    return RefineryCustomQuestion(
      id: json['id']?.toString() ?? '',
      questionText:
          (json['questionText'] ?? json['question_text'])?.toString() ?? '',
    );
  }
}

class RefineryReviewForm {
  final RefinerySong song;
  final List<RefineryCustomQuestion> customQuestions;
  final int reviewRewardCents;

  const RefineryReviewForm({
    required this.song,
    required this.customQuestions,
    required this.reviewRewardCents,
  });

  factory RefineryReviewForm.fromJson(Map<String, dynamic> json) {
    final songJson = json['song'] is Map
        ? Map<String, dynamic>.from(json['song'] as Map)
        : <String, dynamic>{};
    final custom = <RefineryCustomQuestion>[];
    if (json['customQuestions'] is List) {
      for (final e in json['customQuestions'] as List) {
        if (e is Map) {
          custom.add(
            RefineryCustomQuestion.fromJson(Map<String, dynamic>.from(e)),
          );
        }
      }
    }
    return RefineryReviewForm(
      song: RefinerySong.fromJson({
        ...songJson,
        'songId': songJson['id'] ?? songJson['songId'],
      }),
      customQuestions: custom,
      reviewRewardCents: _toInt(json['reviewRewardCents'], 10),
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
  final int chorusRating;
  final int openingEndingRating;
  final String? comment;
  final bool isOutlier;
  final bool favorited;
  final int? qualityRating;

  RefineryReviewItem({
    required this.id,
    required this.createdAt,
    required this.overallRating,
    required this.beatRating,
    required this.lyricsRating,
    required this.chorusRating,
    required this.openingEndingRating,
    required this.comment,
    required this.isOutlier,
    required this.favorited,
    required this.qualityRating,
  });

  RefineryReviewItem copyWith({bool? favorited, int? qualityRating, bool clearQuality = false}) {
    return RefineryReviewItem(
      id: id,
      createdAt: createdAt,
      overallRating: overallRating,
      beatRating: beatRating,
      lyricsRating: lyricsRating,
      chorusRating: chorusRating,
      openingEndingRating: openingEndingRating,
      comment: comment,
      isOutlier: isOutlier,
      favorited: favorited ?? this.favorited,
      qualityRating: clearQuality ? null : (qualityRating ?? this.qualityRating),
    );
  }

  factory RefineryReviewItem.fromJson(Map<String, dynamic> json) {
    final c = json['comment']?.toString();
    final q = json['qualityRating'];
    return RefineryReviewItem(
      id: json['id']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      overallRating: _toInt(json['overallRating']),
      beatRating: _toInt(json['beatRating']),
      lyricsRating: _toInt(json['lyricsRating']),
      chorusRating: _toInt(json['chorusRating']),
      openingEndingRating: _toInt(json['openingEndingRating']),
      comment: (c == null || c.isEmpty) ? null : c,
      isOutlier: json['isOutlier'] == true,
      favorited: json['favorited'] == true,
      qualityRating: q == null ? null : _toInt(q),
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

class RefineryReviewerStatus {
  final bool isReviewer;
  final String? signedUpAt;
  final int totalReviews;

  const RefineryReviewerStatus({
    required this.isReviewer,
    this.signedUpAt,
    this.totalReviews = 0,
  });

  factory RefineryReviewerStatus.fromJson(Map<String, dynamic> json) {
    return RefineryReviewerStatus(
      isReviewer: json['isReviewer'] == true || json['is_reviewer'] == true,
      signedUpAt:
          (json['signedUpAt'] ?? json['signed_up_at'])?.toString(),
      totalReviews: _toInt(json['totalReviews'] ?? json['total_reviews']),
    );
  }
}

/// Shared Refinery program copy / pricing (kept in sync with web).
class RefineryProgram {
  static const String submissionPriceUsd = '4.99';
  static const String submissionOriginalPriceUsd = '9.99';
  static const int minReviews = 100;
  static const int reviewRewardCents = 10;
  static const int maxCustomQuestions = 10;

  static String get reviewRewardUsd =>
      (reviewRewardCents / 100).toStringAsFixed(2);
}

class RefineryService {
  final ApiService _api = ApiService();

  Future<RefineryReviewerStatus> getReviewerStatus() async {
    final res = await _api.get('refinery/reviewer/status');
    if (res is Map<String, dynamic>) {
      return RefineryReviewerStatus.fromJson(res);
    }
    return const RefineryReviewerStatus(isReviewer: false);
  }

  Future<void> signUpAsReviewer() async {
    await _api.post('refinery/reviewer/signup', {});
  }

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

  Future<RefineryReviewForm> getReviewForm(String songId) async {
    final res = await _api.get('refinery/songs/$songId/review-form');
    if (res is Map<String, dynamic>) return RefineryReviewForm.fromJson(res);
    throw Exception('Failed to load review form');
  }

  Future<void> submitReview({
    required String songId,
    required int overallRating,
    required int beatRating,
    required int lyricsRating,
    required int chorusRating,
    required int openingEndingRating,
    required Map<String, String> surveyResponses,
    Map<String, String>? customResponses,
    String? comment,
  }) async {
    await _api.post('refinery/songs/$songId/review', {
      'overallRating': overallRating,
      'beatRating': beatRating,
      'lyricsRating': lyricsRating,
      'chorusRating': chorusRating,
      'openingEndingRating': openingEndingRating,
      'surveyResponses': surveyResponses,
      if (customResponses != null) 'customResponses': customResponses,
      if (comment != null && comment.trim().isNotEmpty)
        'comment': comment.trim(),
    });
  }

  /// Artist adds their own approved song to The Refinery (free / beta path).
  Future<void> addSongToRefinery(
    String songId, {
    List<String> customQuestions = const [],
  }) async {
    await _api.post('refinery/songs/$songId/add', {
      'customQuestions': customQuestions,
    });
  }

  /// Web Stripe Checkout for paid Refinery submission.
  Future<Map<String, dynamic>> createSubmissionCheckout(
    String songId, {
    List<String> customQuestions = const [],
  }) async {
    final res = await _api.post('refinery/songs/$songId/submit', {
      'customQuestions': customQuestions,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  /// Pricing + whether free submissions are enabled.
  Future<({bool submissionFree, int priceCents, int originalPriceCents})>
      getSubmissionPricing() async {
    final res = await _api.get('refinery/standard-questions');
    if (res is! Map<String, dynamic>) {
      return (
        submissionFree: false,
        priceCents: 499,
        originalPriceCents: 999,
      );
    }
    return (
      submissionFree: res['submissionFree'] == true,
      priceCents: _toInt(res['submissionPriceCents'], 499),
      originalPriceCents: _toInt(res['submissionOriginalPriceCents'], 999),
    );
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

  /// Artist favorites / unfavorites a review (favorites sort to the top).
  Future<void> favoriteReview(
    String songId,
    String reviewId,
    bool favorited,
  ) async {
    await _api.post(
      'refinery/songs/$songId/reviews/$reviewId/favorite',
      {'favorited': favorited},
    );
  }

  /// Artist rates the quality of the feedback (1-5, or null to clear).
  Future<void> rateReviewQuality(
    String songId,
    String reviewId,
    int? rating,
  ) async {
    await _api.post(
      'refinery/songs/$songId/reviews/$reviewId/quality',
      {'rating': rating},
    );
  }
}
