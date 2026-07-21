import '../models/track.dart';
import '../models/track_fetch_result.dart';
import 'api_service.dart';

class RadioService {
  final ApiService _apiService = ApiService();
  static const String defaultRadioId = 'global';

  String _withRadio(String endpoint, String radioId) {
    final separator = endpoint.contains('?') ? '&' : '?';
    final encoded = Uri.encodeQueryComponent(radioId.trim());
    return '$endpoint${separator}radio=$encoded';
  }

  Future<TrackFetchResult> getCurrentTrack({
    String radioId = defaultRadioId,
  }) async {
    try {
      final response = await _apiService.get(
        _withRadio('radio/current', radioId),
      );
      if (response == null) return const TrackFetchResult(track: null);
      if (response is Map<String, dynamic>) {
        if (response['no_content'] == true) {
          return TrackFetchResult.noContent(
            (response['message'] ?? 'No songs are currently available.')
                .toString(),
          );
        }
        return TrackFetchResult(track: Track.fromJson(response));
      }
      return const TrackFetchResult(track: null);
    } catch (e) {
      return TrackFetchResult.noContent(
        'Unable to reach radio service. Please try again.',
      );
    }
  }

  Future<TrackFetchResult> getNextTrack({
    String radioId = defaultRadioId,
    bool force = false,
  }) async {
    try {
      var endpoint = _withRadio('radio/next', radioId);
      if (force) {
        endpoint = '$endpoint&force=true';
      }
      final response = await _apiService.get(endpoint);
      if (response == null) return const TrackFetchResult(track: null);
      if (response is Map<String, dynamic>) {
        if (response['no_content'] == true) {
          return TrackFetchResult.noContent(
            (response['message'] ?? 'No songs are currently available.')
                .toString(),
          );
        }
        return TrackFetchResult(track: Track.fromJson(response));
      }
      return const TrackFetchResult(track: null);
    } catch (e) {
      return TrackFetchResult.noContent(
        'Unable to reach radio service. Please try again.',
      );
    }
  }

  Future<TrackFetchResult> peekNextTrack({
    String radioId = defaultRadioId,
  }) async {
    try {
      final response = await _apiService.get(_withRadio('radio/peek', radioId));
      if (response == null) return const TrackFetchResult(track: null);
      if (response is Map<String, dynamic>) {
        if (response['no_content'] == true) {
          return TrackFetchResult.noContent(
            (response['message'] ?? 'No upcoming track available.').toString(),
          );
        }
        return TrackFetchResult(track: Track.fromJson(response));
      }
      return const TrackFetchResult(track: null);
    } catch (e) {
      return TrackFetchResult.noContent(
        'Unable to reach radio service. Please try again.',
      );
    }
  }

  /// Upcoming rotation preview for the listen page queue panel.
  Future<List<UpcomingQueueTrack>> getUpcomingQueue({
    String radioId = defaultRadioId,
    int limit = 12,
  }) async {
    final safeLimit = limit.clamp(1, 50);
    try {
      final endpoint =
          '${_withRadio('radio/queue', radioId)}&limit=$safeLimit';
      final response = await _apiService.get(endpoint);
      if (response is List) {
        return response
            .whereType<Map>()
            .map(
              (row) => UpcomingQueueTrack.fromJson(
                row.map((k, v) => MapEntry(k.toString(), v)),
              ),
            )
            .where((row) => row.id.isNotEmpty)
            .toList();
      }
      return const [];
    } catch (_) {
      return const [];
    }
  }

  Future<void> reportPlay(
    String songId, {
    bool skipped = false,
    String radioId = defaultRadioId,
  }) async {
    try {
      await _apiService.post(_withRadio('radio/play', radioId), {
        'songId': songId,
        'skipped': skipped,
      });
    } catch (e) {
      // Silently fail
    }
  }

  Future<Map<String, dynamic>?> sendHeartbeat({
    required String streamToken,
    required String songId,
    required String timestamp,
    String radioId = defaultRadioId,
  }) async {
    try {
      final response = await _apiService.post(
        _withRadio('radio/heartbeat', radioId),
        {
          'streamToken': streamToken,
          'songId': songId,
          'timestamp': timestamp,
        },
      );
      if (response is Map<String, dynamic>) return response;
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Public endpoint — works for logged-out guests (live listener count).
  Future<void> sendPresence({
    required String streamToken,
    required String songId,
    required String timestamp,
    String radioId = defaultRadioId,
  }) async {
    try {
      await _apiService.post(
        _withRadio('radio/presence', radioId),
        {
          'streamToken': streamToken,
          'songId': songId,
          'timestamp': timestamp,
        },
      );
    } catch (e) {
      // Best effort only.
    }
  }

  // === Prospector's Yield (mobile parity) ===

  Future<Map<String, dynamic>?> getYield() async {
    try {
      final response = await _apiService.get('prospector/yield');
      if (response is Map<String, dynamic>) return response;
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<void> checkIn({String? sessionId}) async {
    try {
      await _apiService.post('prospector/check-in', {
        if (sessionId != null) 'sessionId': sessionId,
      });
    } catch (e) {
      // Silently fail
    }
  }

  Future<Map<String, dynamic>?> submitRefinement({
    required String songId,
    required int score,
    String? playId,
  }) async {
    try {
      final response = await _apiService.post('prospector/refinement', {
        'songId': songId,
        'score': score,
        if (playId != null) 'playId': playId,
      });
      if (response is Map<String, dynamic>) return response;
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> submitSurvey({
    required String songId,
    required Map<String, dynamic> responses,
    String? playId,
  }) async {
    try {
      final response = await _apiService.post('prospector/survey', {
        'songId': songId,
        'responses': responses,
        if (playId != null) 'playId': playId,
      });
      if (response is Map<String, dynamic>) return response;
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> redeem({
    required int amountCents,
    required String type, // 'virtual_visa' | 'merch' | 'boost_credits'
    String? requestId,
  }) async {
    try {
      final response = await _apiService.post('yield/redeem', {
        'amountCents': amountCents,
        'type': type,
        if (requestId != null) 'requestId': requestId,
      });
      if (response is Map<String, dynamic>) return response;
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Check if a song is liked by the current user
  Future<bool> isLiked(String songId) async {
    try {
      final response = await _apiService.get('songs/$songId/like');
      return response['liked'] == true;
    } catch (e) {
      return false;
    }
  }

  /// Toggle like status for a song (like if not liked, unlike if liked)
  Future<bool> toggleLike(String songId) async {
    try {
      final response = await _apiService.post('songs/$songId/like', {});
      return response['liked'] == true;
    } catch (e) {
      return false;
    }
  }

  /// Ensure song is liked (saved to library) without accidentally unliking.
  Future<void> ensureLiked(String songId) async {
    final liked = await isLiked(songId);
    if (liked) return;
    await toggleLike(songId);
  }

  /// Submit a radio reaction vote for the current play.
  Future<Map<String, dynamic>?> submitReaction({
    required String songId,
    String? playId,
    required String reaction, // 'fire' | 'shit'
  }) async {
    Future<Map<String, dynamic>?> attempt() async {
      final response = await _apiService.post('leaderboard/songs/$songId/like', {
        if (playId != null && playId.isNotEmpty) 'playId': playId,
        'reaction': reaction,
      });
      if (response is Map<String, dynamic>) return response;
      return null;
    }

    try {
      return await attempt();
    } on ApiException catch (e) {
      // ApiService already force-refreshes once on 401; one more soft retry
      // covers a race right after resume.
      if (e.statusCode == 401) {
        try {
          return await attempt();
        } catch (_) {
          return null;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}

class UpcomingQueueTrack {
  const UpcomingQueueTrack({
    required this.id,
    required this.title,
    required this.artistName,
    this.artworkUrl,
    this.likeCount,
    this.temperaturePercent,
  });

  final String id;
  final String title;
  final String artistName;
  final String? artworkUrl;
  final int? likeCount;
  final int? temperaturePercent;

  factory UpcomingQueueTrack.fromJson(Map<String, dynamic> json) {
    return UpcomingQueueTrack(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? 'Unknown').toString(),
      artistName: (json['artist_name'] ?? 'Unknown artist').toString(),
      artworkUrl: json['artwork_url']?.toString(),
      likeCount: json['like_count'] is num
          ? (json['like_count'] as num).toInt()
          : null,
      temperaturePercent: json['temperature_percent'] is num
          ? (json['temperature_percent'] as num).round()
          : null,
    );
  }
}
