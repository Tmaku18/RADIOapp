import '../models/song.dart';
import 'api_service.dart';

class RadioService {
  final ApiService _apiService = ApiService();

  Future<Song?> getCurrentTrack() async {
    try {
      final response = await _apiService.get('radio/current');
      if (response.isEmpty) return null;
      return Song.fromJson(response);
    } catch (e) {
      return null;
    }
  }

  Future<Song?> getNextTrack() async {
    try {
      final response = await _apiService.get('radio/next');
      if (response.isEmpty) return null;
      return Song.fromJson(response);
    } catch (e) {
      return null;
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
}
