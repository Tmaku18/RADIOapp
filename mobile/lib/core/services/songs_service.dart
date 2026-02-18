import '../models/song.dart';
import 'api_service.dart';

class SongsService {
  final ApiService _api = ApiService();

  Future<List<Song>> getMine() async {
    final res = await _api.get('songs/mine');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) =>
              Song.fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    return const [];
  }
}

