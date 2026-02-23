import '../models/track.dart';
import '../models/track_fetch_result.dart';
import 'api_service.dart';

class RadioService {
  final ApiService _apiService = ApiService();

  Future<TrackFetchResult> getCurrentTrack() async {
    try {
      final response = await _apiService.get('radio/current');
      if (response == null) return const TrackFetchResult(track: null);
      if (response is Map<String, dynamic>) {
        if (response['no_content'] == true) {
          return TrackFetchResult.noContent(
            (response['message'] ?? 'No songs are currently available.').toString(),
          );
        }
        return TrackFetchResult(track: Track.fromJson(response));
      }
      return const TrackFetchResult(track: null);
    } catch (e) {
      return const TrackFetchResult(track: null);
    }
  }

  Future<TrackFetchResult> getNextTrack() async {
    try {
      final response = await _apiService.get('radio/next');
      if (response == null) return const TrackFetchResult(track: null);
      if (response is Map<String, dynamic>) {
        if (response['no_content'] == true) {
          return TrackFetchResult.noContent(
            (response['message'] ?? 'No songs are currently available.').toString(),
          );
        }
        return TrackFetchResult(track: Track.fromJson(response));
      }
      return const TrackFetchResult(track: null);
    } catch (e) {
      return const TrackFetchResult(track: null);
    }
  }

  Future<void> reportPlay(String songId, {bool skipped = false}) async {
    try {
      await _apiService.post('radio/play', {
        'songId': songId,
        'skipped': skipped,
      });
    } catch (e) {
      // Silently fail
    }
  }

  Future<void> sendHeartbeat({
    required String streamToken,
    required String songId,
    required String timestamp,
  }) async {
    try {
      await _apiService.post('radio/heartbeat', {
        'streamToken': streamToken,
        'songId': songId,
        'timestamp': timestamp,
      });
    } catch (e) {
      // Silently fail
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
  }) async {
    try {
      final response = await _apiService.post('prospector/redeem', {
        'amountCents': amountCents,
        'type': type,
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
}
